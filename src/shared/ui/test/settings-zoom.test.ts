import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canStepZoom, clampZoom, formatZoom, stepZoom } from "../src/lib/settings-zoom";

describe("the UI zoom stepper", () => {
  it("holds any zoom inside 0.5 to 3", () => {
    assert.equal(clampZoom(9), 3);
    assert.equal(clampZoom(0.1), 0.5);
    assert.equal(clampZoom(1.5), 1.5);
  });

  it("moves one decimal at a time and keeps to one decimal", () => {
    assert.equal(stepZoom(1, 1), 1.1);
    assert.equal(stepZoom(1.1, 1), 1.2);
    assert.equal(stepZoom(1, -1), 0.9);
    assert.equal(stepZoom(0.6, -1), 0.5);
  });

  it("stays between 0.5 and 3", () => {
    assert.equal(stepZoom(0.5, -1), 0.5);
    assert.equal(stepZoom(3, 1), 3);
    assert.equal(stepZoom(2.95, 1), 3);
  });

  it("disables a step only at the end it cannot pass", () => {
    assert.equal(canStepZoom(0.5, -1), false);
    assert.equal(canStepZoom(0.5, 1), true);
    assert.equal(canStepZoom(3, 1), false);
    assert.equal(canStepZoom(3, -1), true);
    assert.equal(canStepZoom(1, 1), true);
  });

  it("shows the value with one decimal", () => {
    assert.equal(formatZoom(1), "1.0");
    assert.equal(formatZoom(0.5), "0.5");
    assert.equal(formatZoom(2.25), "2.3");
  });
});
