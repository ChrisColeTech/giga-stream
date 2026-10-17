// A playlist's tokens travel in its addresses' query strings (docs/29 section 18). The store keeps, and the answers
// show, those addresses without the query, the fragment or any credentials; nothing is refused for it.
import assert from "node:assert/strict";
import test from "node:test";

import { refusalWithoutQuery, withoutQuery } from "../src/services/address-rule.js";
import { makeApp, pick, send, signIn } from "./test-app.js";

const PLAYLIST = "https://cdn.example/list.m3u8";
const TOKEN_PLAYLIST = [
  "#EXTM3U",
  '#EXTINF:-1 tvg-logo="https://img.example/news.png?token=logo-secret" group-title="News",Token News',
  "https://cdn.example/news.m3u8?token=stream-secret#frag",
  '#EXTINF:-1 group-title="Sports",Plain Sports',
  "http://insecure.example/sports.m3u8?token=refused-secret",
].join("\n");

/** The playlist at its one address; any other address is missing. */
const fetchPlaylist: typeof fetch = async (input) =>
  String(input) === PLAYLIST ? new Response(TOKEN_PLAYLIST) : new Response("missing", { status: 404 });

test("the address helpers keep the scheme, host and path, and drop the query, fragment and credentials", () => {
  assert.equal(withoutQuery("https://cdn.example/a/b.m3u8?token=x&y=2#frag"), "https://cdn.example/a/b.m3u8");
  assert.equal(withoutQuery("https://user:pw@cdn.example/a.m3u8"), "https://cdn.example/a.m3u8");
  assert.equal(withoutQuery("https://cdn.example/plain.m3u8"), "https://cdn.example/plain.m3u8");
  assert.equal(refusalWithoutQuery("What? (http://x.example/a.m3u8?token=1)"), "What? (http://x.example/a.m3u8)");
});

test("a stream URL with ?token= is stored without it, and so are its logo and the refusal examples", async () => {
  const t = await makeApp({ fetch: fetchPlaylist, config: { PLAYLIST_URLS: [PLAYLIST] } });
  const token = (await signIn(t.app)).access;
  const run = await send(t.app, "POST", "/api/playlist-sync", {}, token);
  assert.equal(run.status, 202);
  assert.deepEqual(pick(run.body, "data.refusalExamples"), ["Plain Sports (http://insecure.example/sports.m3u8)"]);

  const listed = await send(t.app, "GET", "/api/channels");
  const news = (pick(listed.body, "data.items") as Array<Record<string, unknown>>).find((c) => c.name === "Token News");
  assert.ok(news, "the channel was imported");
  assert.equal(news.streamUrl, "https://cdn.example/news.m3u8");
  assert.equal(news.logoUrl, "https://img.example/news.png");
  const everything = JSON.stringify(listed.body) + JSON.stringify(run.body);
  assert.equal(everything.includes("secret"), false, "no token reaches a stored or answered address");
});
