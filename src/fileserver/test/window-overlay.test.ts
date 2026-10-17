import test from "node:test";
import assert from "node:assert/strict";

import { installWindowOverlayIpc, SET_OVERLAY_CHANNEL } from "../src/app/window-overlay.js";

type Listener = (event: { senderFrame?: { frameTreeNodeId: number } | null }, ...args: unknown[]) => unknown;
type Applied = { color?: string; symbolColor?: string; height?: number };

const APP_FRAME = 7;

/** The handler the module registers, plus a fake window that records what it was told to wear. */
function rig(options: { destroyed?: boolean; throws?: boolean; noWindow?: boolean } = {}) {
  let listener: Listener | undefined;
  let channel = "";
  const applied: Applied[] = [];
  installWindowOverlayIpc(
    {
      handle: (name, handler) => {
        channel = name;
        listener = handler;
      },
    },
    () => APP_FRAME,
    () =>
      options.noWindow
        ? null
        : {
            isDestroyed: () => options.destroyed === true,
            setTitleBarOverlay: (overlay) => {
              if (options.throws) throw new Error("Titlebar overlay is not enabled");
              applied.push(overlay);
            },
          },
  );
  const send = (value: unknown, frame: number | null = APP_FRAME, ...extra: unknown[]): unknown => {
    assert.ok(listener !== undefined);
    return listener({ senderFrame: frame === null ? null : { frameTreeNodeId: frame } }, value, ...extra);
  };
  return { send, applied, channel: () => channel };
}

test("the overlay is registered on its one channel and passes a colour, symbol colour and height to the window", () => {
  const t = rig();
  assert.equal(t.channel(), SET_OVERLAY_CHANNEL);
  assert.equal(t.send({ color: "#f7f7f8", symbolColor: "#66666e", height: 39 }), true);
  assert.deepEqual(t.applied, [{ color: "#f7f7f8", symbolColor: "#66666e", height: 39 }]);
});

test("Theatre's short black reaches the strip: a three-digit hex is accepted and widened", () => {
  const t = rig();
  assert.equal(t.send({ color: "#000", symbolColor: "#a3a3ac" }), true);
  assert.deepEqual(t.applied, [{ color: "#000000", symbolColor: "#a3a3ac" }]);
  assert.equal(t.send({ color: "#AbC" }), true);
  assert.deepEqual(t.applied[1], { color: "#AAbbCC" });
});

test("a height is rounded and clamped, and each field is optional", () => {
  const t = rig();
  t.send({ height: 38.6 });
  t.send({ height: 0 });
  t.send({ height: 9000 });
  assert.deepEqual(t.applied, [{ height: 39 }, { height: 1 }, { height: 200 }]);
});

test("a value that is not a plain hex colour or a finite height is refused, never passed on", () => {
  const t = rig();
  const refused: unknown[] = [
    null,
    "#000000",
    [],
    {},
    { color: "red" },
    { color: "#12345" },
    { color: "#1234567" },
    { color: "rgb(0, 0, 0)" },
    { color: 0 },
    { height: Number.NaN },
    { height: "40" },
    { symbolColor: "color-mix(in srgb, #fff 70%, white)" },
  ];
  for (const value of refused) assert.throws(() => t.send(value), TypeError);
  assert.throws(() => t.send({ color: "#000000" }, APP_FRAME, "extra"), TypeError);
  assert.deepEqual(t.applied, []);
});

test("an unknown field is dropped and a valid one beside it still applies", () => {
  const t = rig();
  t.send({ color: "#18181b", script: "alert(1)", extra: true });
  assert.deepEqual(t.applied, [{ color: "#18181b" }]);
});

test("only the app frame may change the overlay", () => {
  const t = rig();
  assert.throws(() => t.send({ color: "#000000" }, 99), /only to the app frame/);
  assert.throws(() => t.send({ color: "#000000" }, null), /only to the app frame/);
  assert.deepEqual(t.applied, []);
});

test("with no window, a destroyed window or an overlay the platform lacks, the answer is false and nothing throws", () => {
  assert.equal(rig({ noWindow: true }).send({ height: 40 }), false);
  assert.equal(rig({ destroyed: true }).send({ height: 40 }), false);
  assert.equal(rig({ throws: true }).send({ height: 40 }), false);
});
