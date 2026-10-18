import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { JobScheduleGroup } from "@/components/jobs/JobScheduleGroup";
import { changedFields } from "@/lib/job-body";
import { scheduleRefusal } from "@/lib/job-checks";
import { draftOf } from "@/lib/job-draft";
import { jobRow } from "@/lib/job-rows";
import { CUSTOM, SCHEDULE_OPTIONS, scheduleChoice, scheduleLabel, scheduleStatus } from "@/lib/job-schedule";
import type { AdminJob } from "@/services/schemas/job-schema";
import { renderLive } from "./support/store";

const SAVE = { onPress: () => undefined };

const job = (schedule: string, enabled = true): AdminJob => ({
  id: 1,
  name: "Trending",
  type: "catalog",
  enabled,
  schedule,
  config: { scope: "trending", kind: "movie", pages: 5 },
  running: false,
  createdAt: 1,
});

/** The forms the backend stores (`normaliseSchedule`), every one the picker lists. */
const BACKEND_FORMS = ["off", "15m", "30m", "1h", "6h", "12h", "24h"];

describe("the schedule options", () => {
  it("list exactly the backend's usual forms, each valid for the interval check and round-tripping", () => {
    assert.deepEqual(SCHEDULE_OPTIONS.map((option) => option.value), BACKEND_FORMS);
    for (const value of BACKEND_FORMS) {
      assert.equal(scheduleChoice(value), value, value);
      assert.equal(scheduleRefusal(value), null, value);
      assert.equal(changedFields(job(value), draftOf(job(value))).schedule, undefined, value);
    }
  });

  it("word them the same in the picker, the list and the status", () => {
    assert.deepEqual(SCHEDULE_OPTIONS.map((option) => option.label), [
      "Off", "Every 15 minutes", "Every 30 minutes", "Every hour", "Every 6 hours", "Every 12 hours", "Every day",
    ]);
    assert.equal(jobRow(job("off")).schedule, "Off");
    assert.equal(jobRow(job("6h")).schedule, "Every 6 hours");
    assert.equal(scheduleStatus(job("6h")), "Scheduled");
    assert.equal(scheduleStatus(job("off")), "Not scheduled");
    assert.equal(scheduleStatus(job("6h", false)), "Disabled");
  });

  it("show a stored value outside the list as Custom with its text, never changed", () => {
    for (const value of ["90m", "2h", "45s", "500ms"]) assert.equal(scheduleChoice(value), CUSTOM, value);
    assert.equal(scheduleLabel("90m"), "Every 90 minutes");
    assert.equal(scheduleLabel("2h"), "Every 2 hours");
    assert.equal(scheduleLabel("1s"), "Every second");
    assert.equal(scheduleLabel("bogus"), "bogus");
    assert.equal(scheduleRefusal("45s"), null);
    const props = { value: "90m", job: job("90m"), error: undefined, onChange: () => undefined, save: SAVE };
    const html = renderLive(createElement(JobScheduleGroup, props));
    assert.ok(html.includes('<option value="custom" selected="">Custom...</option>'));
    assert.ok(html.includes('aria-label="Custom interval"') && html.includes('value="90m"'));
  });

  it("send only a changed schedule in the PATCH", () => {
    const saved = job("6h");
    assert.deepEqual(changedFields(saved, { ...draftOf(saved), schedule: "off" }), { schedule: "off" });
    assert.deepEqual(changedFields(saved, { ...draftOf(saved), schedule: "12h", enabled: false }), {
      enabled: false,
      schedule: "12h",
    });
  });
});

describe("the Schedule group", () => {
  const render = (value: string, saved: AdminJob): string =>
    renderLive(createElement(JobScheduleGroup, { value, job: saved, error: undefined, onChange: () => undefined, save: SAVE }));

  it("is a picker, with the text field only for Custom", () => {
    const html = render("6h", job("6h"));
    assert.match(html, /<select[^>]*aria-label="Interval"/);
    for (const label of ["Off", "Every 15 minutes", "Every hour", "Every day", "Custom..."]) {
      assert.ok(html.includes(`>${label}</option>`), label);
    }
    assert.ok(html.includes('<option value="6h" selected="">') && !html.includes('aria-label="Custom interval"'));
    assert.ok(!html.includes("Next run") && html.includes(">Scheduled<"));
  });

  it("shows Off clearly for a job that is not scheduled, and the status of a disabled one", () => {
    const off = render("off", job("off"));
    assert.ok(off.includes('<option value="off" selected="">Off</option>') && off.includes(">Not scheduled<"));
    assert.ok(render("6h", job("6h", false)).includes(">Disabled<"));
  });
});
