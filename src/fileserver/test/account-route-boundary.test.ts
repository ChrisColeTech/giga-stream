import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = (name: string): string =>
  readFileSync(path.resolve("src", "routes", name), "utf8");

test("account routes call only their one facade and never compose authentication", () => {
  const auth = source("account-auth.ts");
  const data = source("account-data.ts");
  const watch = source("watch.ts");
  assert.equal(auth.includes("services.accountAuth"), false);
  assert.equal(auth.includes("services.accountData"), false);
  assert.equal(data.includes("services.accountAuth"), false);
  assert.equal(data.includes("services.accountData"), false);
  assert.equal(watch.includes("services.accountAuth"), false);
  assert.equal(watch.includes("services.accountData"), false);
  assert.match(auth, /services\.accountApi\./);
  assert.match(data, /services\.accountApi\./);
  assert.match(watch, /services\.watchRouting\./);
});
