import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEVER_SCANNED, SCAN_LABEL } from "@/lib/collections-copy";
import { lastScanLabel, lastScanTitle } from "@/lib/collections-scan";

describe("the last scan column", () => {
  it("a folder that never finished a scan says so", () => {
    assert.equal(lastScanLabel(undefined), NEVER_SCANNED);
  });

  it("a finished scan shows a short local date that fits the column; the year is in the tooltip", () => {
    const at = Date.UTC(2026, 9, 16, 12, 0, 0);
    const year = String(new Date(at).getFullYear());
    assert.ok(lastScanLabel(at).length <= 18);
    assert.ok(!lastScanLabel(at).includes(year));
    assert.ok(lastScanTitle(at)?.includes(year));
    assert.equal(lastScanTitle(undefined), undefined);
  });
});

describe("the scan state words", () => {
  it("names each of the three states", () => {
    assert.deepEqual(
      [SCAN_LABEL.idle, SCAN_LABEL.scanning, SCAN_LABEL.failed],
      ["Idle", "Scanning", "Failed"],
    );
  });
});
