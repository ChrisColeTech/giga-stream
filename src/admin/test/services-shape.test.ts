import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { NOT_CONNECTED_CODE } from "@/constants/api-sentences";
import { accountState } from "@/services/account-state";
import { accounts } from "@/services/accounts";
import { channels } from "@/services/channels";
import { health } from "@/services/health";
import { isNotConnected } from "@/services/not-connected";
import { jobs } from "@/services/jobs";
import { playlists } from "@/services/playlists";
import { providers } from "@/services/providers";
import { titles } from "@/services/titles";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const RECORD_SERVICES = { channels, providers, titles, playlists, jobs, accounts };
const STUBS = { channels, providers, titles };

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? sources(join(dir, item.name)) : /\.(ts|tsx)$/.test(item.name) ? [join(dir, item.name)] : [],
  );
}

describe("the service modules", () => {
  it("give every record tab the same four methods: list, create, update, remove", () => {
    for (const [name, service] of Object.entries(RECORD_SERVICES)) {
      for (const method of ["list", "create", "update", "remove"] as const) {
        assert.equal(typeof service[method], "function", `${name}.${method}`);
      }
    }
  });

  it("carry each tab's own extras beside them: channels rebuild, revert and the fault pair; jobs run", () => {
    for (const method of ["rebuild", "revert", "applyFault", "clearFault"] as const) {
      assert.equal(typeof channels[method], "function", method);
    }
    assert.equal(typeof jobs.run, "function");
  });

  it("refuse, in every method of a tab not wired yet, with the typed not-connected ApiError", async () => {
    for (const [name, service] of Object.entries(STUBS)) {
      for (const call of [() => service.list(), () => service.create({}), () => service.update(1 as never, {}), () => service.remove(1 as never)]) {
        await assert.rejects(call(), (error: unknown) => {
          assert.ok(error instanceof ApiError && error.code === NOT_CONNECTED_CODE, name);
          assert.ok(isNotConnected(error) && error.message.length > 0);
          return true;
        });
      }
    }
    for (const call of [() => accountState.read(), () => accountState.write({}), () => health.read(), () => channels.rebuild("x")]) {
      await assert.rejects(call(), isNotConnected);
    }
  });
});

describe("the source", () => {
  it("has no fixtures folder, and nothing outside services imports from one", () => {
    assert.equal(existsSync(join(SRC, "fixtures")), false);
    const offenders = sources(SRC)
      .filter((path) => !path.includes(`${join(SRC, "services")}`))
      .filter((path) => /from\s+["'][^"']*\/fixtures\//.test(readFileSync(path, "utf8")));
    assert.deepEqual(offenders, []);
  });
});
