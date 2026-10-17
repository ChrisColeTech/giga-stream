// The Electron host's pure parts (src/app): navigation, the IPC sender check, the folder picker and the caption
// overlay. None of them imports electron, so they run under plain node.
import assert from "node:assert/strict";
import test from "node:test";

import { describeTarget, judgeNavigation } from "../src/app/navigation.js";
import { CHOOSE_FOLDER_CHANNEL, installNativeDialogIpc, type OpenFolderDialog } from "../src/app/native-dialog.js";
import { isTrustedSender, type IpcSender } from "../src/app/trust.js";
import { installWindowOverlayIpc, overlayOf, SET_OVERLAY_CHANNEL } from "../src/app/window-overlay.js";

const BACKEND = "http://127.0.0.1:8091";
const VITE = "http://127.0.0.1:5172";
const ALLOWED: ReadonlySet<string> = new Set([BACKEND, VITE]);
const MAIN = 7;

type Listener = (event: IpcSender, ...args: unknown[]) => unknown;

/** An ipc stand-in that keeps the handler registered per channel. */
function fakeIpc() {
  const handlers = new Map<string, Listener>();
  return {
    handlers,
    handle: (channel: string, listener: Listener) => void handlers.set(channel, listener),
    call: async (channel: string, event: IpcSender, ...args: unknown[]) => {
      const handler = handlers.get(channel);
      assert.ok(handler, `no handler for ${channel}`);
      return handler(event, ...args);
    },
  };
}

const from = (url: string, id = MAIN): IpcSender => ({ senderFrame: { frameTreeNodeId: id, url } });
const trusted = (event: IpcSender): boolean => isTrustedSender(event, () => MAIN, ALLOWED);

test("navigation stays on the backend and the dev server; everything else is refused", () => {
  assert.equal(judgeNavigation(ALLOWED, `${BACKEND}/admin/`), "allow");
  assert.equal(judgeNavigation(ALLOWED, `${VITE}/admin/`), "allow");
  for (const target of ["https://example.test/", "http://127.0.0.1:9999/admin/", "file:///c:/x.html", "not a url", ""]) {
    assert.equal(judgeNavigation(ALLOWED, target), "refuse", target);
  }
  assert.equal(describeTarget("https://example.test/a/b?x=1"), "https://example.test");
  assert.equal(describeTarget("::"), "an unreadable address");
});

test("only the main frame at an allowed origin is trusted", () => {
  assert.equal(trusted(from(`${BACKEND}/admin/`)), true);
  assert.equal(trusted(from(`${VITE}/admin/`)), true);
  assert.equal(trusted(from(`${BACKEND}/admin/`, MAIN + 1)), false, "a nested frame");
  assert.equal(trusted(from("https://example.test/")), false, "another origin");
  assert.equal(trusted(from("garbage")), false, "an unreadable address");
  assert.equal(trusted({ senderFrame: null }), false, "a detached sender");
  assert.equal(trusted({}), false, "no frame at all");
});

test("the folder picker answers the first path, or null when cancelled", async () => {
  const ipc = fakeIpc();
  const seen: unknown[] = [];
  let answer: { canceled: boolean; filePaths: string[] } = { canceled: false, filePaths: ["D:\\media\\news", "D:\\other"] };
  const open: OpenFolderDialog = async (_window, options) => {
    seen.push(options);
    return answer;
  };
  installNativeDialogIpc(ipc, trusted, () => ({ isDestroyed: () => false }), open);

  assert.equal(await ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`)), "D:\\media\\news");
  assert.deepEqual(seen[0], { properties: ["openDirectory"], title: "Choose a folder" });
  answer = { canceled: true, filePaths: ["D:\\ignored"] };
  assert.equal(await ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`)), null);
  answer = { canceled: false, filePaths: [] };
  assert.equal(await ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`)), null);
});

test("the folder picker refuses an untrusted sender, arguments, and a closed window", async () => {
  const ipc = fakeIpc();
  let opened = 0;
  const open: OpenFolderDialog = async () => {
    opened += 1;
    return { canceled: false, filePaths: ["D:\\x"] };
  };
  let destroyed = false;
  installNativeDialogIpc(ipc, trusted, () => ({ isDestroyed: () => destroyed }), open);

  await assert.rejects(ipc.call(CHOOSE_FOLDER_CHANNEL, from("https://example.test/")), /only to the app/);
  await assert.rejects(ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`, MAIN + 1)), /only to the app/);
  await assert.rejects(ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`), "D:\\"), /no arguments/);
  destroyed = true;
  assert.equal(await ipc.call(CHOOSE_FOLDER_CHANNEL, from(`${BACKEND}/admin/`)), null);
  assert.equal(opened, 0, "no dialog opened for any of these");
});

test("the overlay accepts a hex colour, a symbol colour and a clamped height only", () => {
  assert.deepEqual(overlayOf({ color: "#18181b", symbolColor: "#a3a3ac", height: 40.4 }), {
    color: "#18181b",
    symbolColor: "#a3a3ac",
    height: 40,
  });
  assert.deepEqual(overlayOf({ color: "#000" }), { color: "#000000" });
  assert.deepEqual(overlayOf({ height: 9999 }), { height: 200 });
  assert.deepEqual(overlayOf({ height: -4 }), { height: 1 });
  for (const bad of [null, "x", 3, {}, { color: "red" }, { color: "#12345" }, { height: "40" }, { height: Number.NaN }]) {
    assert.throws(() => overlayOf(bad), TypeError, JSON.stringify(bad));
  }
  assert.throws(() => overlayOf({ color: "#fff" }, "extra"), TypeError);
});

test("the overlay is applied for the app's page and refused for anyone else", async () => {
  const ipc = fakeIpc();
  const applied: unknown[] = [];
  let destroyed = false;
  let fail = false;
  installWindowOverlayIpc(ipc, trusted, () => ({
    isDestroyed: () => destroyed,
    setTitleBarOverlay: (overlay) => {
      if (fail) throw new Error("no overlay on this platform");
      applied.push(overlay);
    },
  }));

  assert.equal(await ipc.call(SET_OVERLAY_CHANNEL, from(`${VITE}/admin/`), { color: "#111113" }), true);
  assert.deepEqual(applied, [{ color: "#111113" }]);
  await assert.rejects(ipc.call(SET_OVERLAY_CHANNEL, from("https://example.test/"), { color: "#111113" }), /only to the app/);
  fail = true;
  assert.equal(await ipc.call(SET_OVERLAY_CHANNEL, from(`${VITE}/admin/`), { color: "#111113" }), false);
  fail = false;
  destroyed = true;
  assert.equal(await ipc.call(SET_OVERLAY_CHANNEL, from(`${VITE}/admin/`), { color: "#111113" }), false);
  assert.equal(applied.length, 1);
});
