import assert from "node:assert/strict";
import test from "node:test";

import { databaseSelection } from "../src/store/database.js";

test("database selection honors explicit Turso configuration without a local fallback", () => {
  assert.equal(databaseSelection("development", "libsql://admin.example.turso.io"), "remote");
  assert.equal(databaseSelection("development", ""), "local");
  assert.equal(databaseSelection("production", ""), "refuse");
});
