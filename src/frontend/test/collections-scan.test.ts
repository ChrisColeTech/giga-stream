import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NEVER_SCANNED, SCAN_LABEL } from "@/lib/collections-copy";
import { lastScanLabel } from "@/lib/collections-scan";

describe("the last scan column", () => {
  it("a folder that never finished a scan says so", () => {
    assert.equal(lastScanLabel(undefined), NEVER_SCANNED);
  });

  it("a finished scan shows its local date, with the year in it", () => {
    const at = Date.UTC(2026, 9, 16, 12, 0, 0);
    const label = lastScanLabel(at);
    assert.ok(label.length > 0);
    assert.ok(label.includes(String(new Date(at).getFullYear())));
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
