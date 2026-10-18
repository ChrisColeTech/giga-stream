// What the import accepts and refuses inside a playlist (docs/43 sections 3.2 and 7): M3U detection, the address rule
// for stream and logo addresses, refusal examples that carry names only, NFC names, the entry cap. No network.
import assert from "node:assert/strict";
import test from "node:test";

import { setupPlaylists, uploadFile, entry, playlistOf, M3U } from "./playlist-kit.js";
import { pick } from "./test-app.js";

const NAME = "rules.m3u";

test("a body that is not an M3U playlist creates nothing: plain text, an HTML page that mentions the word, a late EXTINF", async () => {
  const { t, token, api } = await setupPlaylists();
  const html = "<html><body><p>Put #EXTM3U on the first line of your file, then one #EXTINF per channel.</p></body></html>";
  const lateExtinf = `${"# note\n".repeat(25)}${entry("ABC", "abc")}`;
  for (const body of ["this is not a playlist", html, lateExtinf, "", "<!doctype html>"]) {
    const answer = await uploadFile(t, token, NAME, body);
    assert.deepEqual([answer.status, pick(answer.body, "error.code")], [422, "playlist.invalid"], body.slice(0, 30));
  }
  assert.equal(pick((await api("GET", "/api/playlists")).body, "data.items.length"), 0);
});

test("a header after a byte-order mark and blank lines, or an EXTINF within the first 20 lines, is a playlist", async () => {
  const { t, token } = await setupPlaylists();
  const bom = await uploadFile(t, token, "bom.m3u", `﻿\n\n${M3U}`);
  assert.equal(pick(bom.body, "data.imported.created"), 2);
  const headerless = await uploadFile(t, token, "bare.m3u", `# note\n${entry("ABC", "abc")}`);
  assert.equal(pick(headerless.body, "data.imported.created"), 1);
});

test("an entry whose stream or logo address breaks the rule is refused and counted; examples are names only", async () => {
  const { t, token, adminChannels, audit } = await setupPlaylists();
  const long = `https://stream.example/${"a".repeat(2100)}.m3u8`;
  const text = playlistOf(
    entry("Good", "good"),
    entry("Plain http", "x").replace("https://", "http://"),
    entry("Private literal", "x").replace("stream.example", "10.1.2.3"),
    entry("Loopback", "x").replace("stream.example", "127.0.0.1"),
    entry("Link local", "x").replace("stream.example", "[fe80::1]"),
    entry("Credentials", "x").replace("stream.example", "user:pw@stream.example"),
    entry("Bad logo", "ok", 'tvg-logo="http://img.example/logo.png" '),
    entry("Private logo", "ok2", 'tvg-logo="https://192.168.1.5/logo.png" '),
    `#EXTINF:-1 group-title="News",Long address\n${long}`,
    entry("Good logo", "ok3", 'tvg-logo="https://img.example/logo.png" '),
  );
  const answer = await uploadFile(t, token, NAME, text);
  assert.deepEqual(
    ["created", "refused", "skipped"].map((f) => pick(answer.body, `data.imported.${f}`)),
    [2, 8, 0],
  );
  const examples = pick(answer.body, "data.imported.refusalExamples") as string[];
  assert.deepEqual(examples.slice(0, 3), ["Plain http", "Private literal", "Loopback"]);
  const everything = JSON.stringify([answer.body, await audit()]);
  for (const address of ["stream.example/x", "10.1.2.3", "192.168.1.5", "img.example", "http://"]) {
    assert.equal(everything.includes(address), false, `no address in an answer or the audit: ${address}`);
  }
  assert.deepEqual((await adminChannels()).map((r) => r.name).sort(), ["Good", "Good logo"]);
});

test("names are NFC-normalised, repeats and the entry cap are counted as skipped", async () => {
  const { t, token, adminChannels } = await setupPlaylists({ config: { PLAYLIST_SYNC_MAX: 3 } });
  const decomposed = "Café TV";
  const text = playlistOf(entry(decomposed, "cafe"), entry(decomposed, "cafe"), entry("Two", "two"), entry("Three", "three"), entry("Four", "four"));
  const answer = await uploadFile(t, token, NAME, text);
  assert.deepEqual(["created", "skipped"].map((f) => pick(answer.body, `data.imported.${f}`)), [3, 2], "one repeat, one past the cap");
  assert.deepEqual((await adminChannels()).map((r) => r.name).sort(), ["Café TV", "Three", "Two"].sort());
  assert.equal((await adminChannels()).some((r) => r.name === decomposed), false);
  const again = await uploadFile(t, token, NAME, text);
  assert.deepEqual(["created", "updated"].map((f) => pick(again.body, `data.imported.${f}`)), [0, 0], "the composed name matches itself");
});

test("with the development flag a loopback playlist address is allowed, a private one still is not", async () => {
  const { t, token, adminChannels } = await setupPlaylists({ loopback: true });
  const text = playlistOf(
    entry("Local", "x").replace("https://stream.example", "http://127.0.0.1:9000"),
    entry("Private", "x").replace("stream.example", "10.0.0.8"),
  );
  const answer = await uploadFile(t, token, NAME, text);
  assert.deepEqual(["created", "refused"].map((f) => pick(answer.body, `data.imported.${f}`)), [1, 1]);
  assert.deepEqual((await adminChannels()).map((r) => r.name), ["Local"]);
});
