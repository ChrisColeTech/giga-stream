import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventFromAudit } from "@/lib/event-sentence";
import type { AuditEntry } from "@/types/admin-audit";

const ADA = "ada@example.test";
const entry = (action: string, extra: Partial<AuditEntry> = {}): AuditEntry => ({ id: 1, at: 1000, action, ...extra });

describe("the session actions", () => {
  it("says who signed in and out, as info in the Session area", () => {
    const login = eventFromAudit(entry("auth.login", { actorUsername: ADA }));
    assert.deepEqual([login.area, login.tone, login.sentence], ["Session", "info", `${ADA} signed in`]);
    assert.equal(eventFromAudit(entry("auth.logout", { actorUsername: ADA })).sentence, `${ADA} signed out`);
  });

  it("makes a failed sign-in a warning that names the username tried, and no actor", () => {
    const failed = eventFromAudit(entry("auth.login_failed", { detail: { username: "eve@example.test" } }));
    assert.deepEqual([failed.area, failed.tone, failed.sentence], ["Session", "warn", "Sign-in failed for eve@example.test"]);
    assert.equal(eventFromAudit(entry("auth.login_failed")).sentence, "Sign-in failed for an unknown username");
  });

  it("never lets a password reach the sentence", () => {
    const changed = eventFromAudit(
      entry("auth.password_changed", { actorUsername: ADA, detail: { password: "hunter2", newPassword: "hunter3", token: "t" } }),
    );
    assert.equal(changed.sentence, `${ADA} changed a password`);
    const created = eventFromAudit(entry("account.created", { actorUsername: ADA, detail: { name: "ed@example.test", password: "hunter2" } }));
    for (const row of [changed, created]) {
      assert.ok(!/hunter|token/.test(JSON.stringify(row)), JSON.stringify(row));
    }
  });
});

describe("the record actions", () => {
  it("map each prefix to its area and name the actor, the verb, the kind and the record", () => {
    const cases: Array<[AuditEntry, string, string]> = [
      [entry("account.created", { actorUsername: ADA, detail: { name: "ed@example.test" } }), "Account", `${ADA} created account ed@example.test`],
      [entry("channel.updated", { actorUsername: ADA, detail: { name: "Fixture News" } }), "Channel", `${ADA} updated channel Fixture News`],
      [entry("channel.deleted", { actorUsername: ADA, detail: { name: "Old" } }), "Channel", `${ADA} deleted channel Old`],
      [entry("channel.rebuilt", { actorUsername: ADA, detail: { name: "Fixture News" } }), "Channel", `${ADA} rebuilt channel Fixture News`],
      [entry("channel.reverted", { actorUsername: ADA, detail: { name: "Fixture News" } }), "Channel", `${ADA} reverted channel Fixture News`],
      [entry("provider.created", { actorUsername: ADA, detail: { name: "VidZee" } }), "Provider", `${ADA} created provider VidZee`],
      [entry("title.updated", { actorUsername: "ed@example.test", detail: { title: "Inception" } }), "Title", "ed@example.test updated title Inception"],
      [entry("playlist.created", { actorUsername: ADA, detail: { host: "iptv.example.test" } }), "Playlist", `${ADA} created playlist iptv.example.test`],
      [entry("job.ran", { actorUsername: ADA, detail: { name: "Trending movies" } }), "Job", `${ADA} ran job Trending movies`],
    ];
    for (const [input, area, sentence] of cases) {
      const row = eventFromAudit(input);
      assert.deepEqual([row.area, row.tone, row.sentence], [area, "info", sentence], input.action);
    }
  });

  it("falls back from the entry's own name to the name the admin holds, then to the id", () => {
    const subject = entry("channel.updated", { actorUsername: ADA, subject: "ch-9" });
    assert.equal(eventFromAudit(subject, { "ch-9": "Fixture Music" }).sentence, `${ADA} updated channel Fixture Music`);
    assert.equal(eventFromAudit(subject).sentence, `${ADA} updated channel ch-9`);
    const named = entry("channel.updated", { actorUsername: ADA, subject: "ch-9", detail: { name: "Own" } });
    assert.equal(eventFromAudit(named, { "ch-9": "Held" }).sentence, `${ADA} updated channel Own`);
  });

  it("names an account by its username: created and deleted carry it, updated gets the held username, then the name", () => {
    const created = entry("account.created", { actorUsername: ADA, subject: "a1", detail: { username: "ed@example.test" } });
    assert.equal(eventFromAudit(created).sentence, `${ADA} created account ed@example.test`);
    const deleted = entry("account.deleted", { actorUsername: ADA, subject: "a1", detail: { username: "ed@example.test" } });
    assert.equal(eventFromAudit(deleted, { a1: "other@example.test" }).sentence, `${ADA} deleted account ed@example.test`);
    const updated = entry("account.updated", { actorUsername: ADA, subject: "a1", detail: { name: "Ed", fields: ["name"] } });
    assert.equal(eventFromAudit(updated, { a1: "ed@example.test" }).sentence, `${ADA} updated account ed@example.test`);
    assert.equal(eventFromAudit(updated).sentence, `${ADA} updated account Ed`);
    const bare = entry("account.updated", { actorUsername: ADA, subject: "a1" });
    assert.equal(eventFromAudit(bare).sentence, `${ADA} updated account a1`);
  });

  it("words the security question and the password reset by username, never with an answer", () => {
    const set = eventFromAudit(
      entry("account.security_question_set", { actorUsername: ADA, subject: "a1", detail: { username: "ed@example.test", answer: "Rex" } }),
    );
    assert.deepEqual([set.area, set.tone, set.sentence], ["Account", "info", `${ADA} set a security question for ed@example.test`]);
    const failed = eventFromAudit(entry("auth.reset_failed", { detail: { username: "eve", answer: "Rex" } }));
    assert.deepEqual([failed.tone, failed.sentence], ["warn", "Password reset failed for eve"]);
    const done = eventFromAudit(entry("auth.reset_completed", { actorUsername: ADA, detail: { username: ADA } }));
    assert.deepEqual([done.tone, done.sentence], ["info", `${ADA} reset a password`]);
  });

  it("calls the actor `system` when the entry has none", () => {
    assert.equal(eventFromAudit(entry("channel.created", { detail: { name: "X" } })).sentence, "system created channel X");
    const sync = eventFromAudit(entry("sync.started"));
    assert.deepEqual([sync.area, sync.sentence], ["Job", "system started a catalog sync"]);
  });

  it("words the faults, and the import with its counts", () => {
    const set = eventFromAudit(entry("channel.fault_set", { actorUsername: ADA, detail: { name: "Fixture News", fault: "stall" } }));
    assert.equal(set.sentence, `${ADA} applied fault stall to Fixture News`);
    const cleared = eventFromAudit(entry("channel.fault_cleared", { actorUsername: ADA, detail: { name: "Fixture News" } }));
    assert.equal(cleared.sentence, `${ADA} cleared the fault on Fixture News`);
    const imported = eventFromAudit(entry("channel.imported", { detail: { created: 3, updated: 1, removed: 0, refused: 0 } }));
    assert.deepEqual([imported.tone, imported.sentence], ["info", "system synced channels: 3 created, 1 updated"]);
    const refused = eventFromAudit(entry("channel.imported", { actorUsername: ADA, detail: { created: 2, refused: 4 } }));
    assert.deepEqual([refused.tone, refused.sentence], ["warn", `${ADA} synced channels: 2 created, 4 refused`]);
  });

  it("makes an outcome with a failure word an error, in the action's own area, with the outcome as the sentence", () => {
    const build = eventFromAudit(entry("channel.rebuilt", { detail: { name: "Fixture Movies", outcome: "Fixture Movies failed to build" } }));
    assert.deepEqual([build.area, build.tone, build.sentence], ["Channel", "error", "Fixture Movies failed to build"]);
    const sync = eventFromAudit(entry("sync.finished", { detail: { outcome: "Job Popular series failed: TMDB is unavailable" } }));
    assert.deepEqual([sync.area, sync.tone], ["Job", "error"]);
    const fine = eventFromAudit(entry("sync.finished", { actorUsername: ADA, detail: { outcome: "12 titles synced" } }));
    assert.equal(fine.tone, "info", "an outcome without a failure word is no error");
  });

  it("keeps the entry's time and gives the row a stable id; an action it does not know lands on Connection", () => {
    const row = eventFromAudit(entry("channel.created", { id: 42, at: 5555, detail: { name: "X" } }));
    assert.deepEqual([row.id, row.at], ["audit-42", 5555]);
    assert.equal(eventFromAudit(entry("widget.polished", { actorUsername: ADA })).area, "Connection");
  });
});

