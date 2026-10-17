import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLicences } from "@/services/settings";

describe("About licences", () => {
  it("stays a disabled-with-reason press until the fileserver serves a licences route", () => {
    assert.deepEqual(readLicences(), { ok: false, message: "The fileserver does not serve licences yet." });
  });
});
