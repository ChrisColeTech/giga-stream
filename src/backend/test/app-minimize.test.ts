// Minimize-to-tray's pure parts (src/app): the hide-or-leave decision and the reveal order. Electron is never imported.
import assert from "node:assert/strict";
import test from "node:test";

import { decideMinimize, revealSteps } from "../src/app/minimize-to-tray.js";

test("a minimize hides the window to the tray while the app runs, and does nothing during a quit", () => {
  assert.equal(decideMinimize(false), "hide");
  assert.equal(decideMinimize(true), "leave");
});

test("a minimised window is restored before it is shown and focused; a hidden normal one is only shown and focused", () => {
  assert.deepEqual(revealSteps(true), ["restore", "show", "focus"]);
  assert.deepEqual(revealSteps(false), ["show", "focus"]);
});
