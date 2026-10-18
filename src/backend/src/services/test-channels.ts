import { existsSync } from "node:fs";
import path from "node:path";

import type { VariantName } from "../constants/live-media.js";
import type { ChannelRecord } from "../types/channel.js";
import type { LiveChannelInput } from "../types/channel-input.js";
import type { LiveCategory } from "../types/live-stream.js";
import type { ChannelService } from "./channel-service.js";

/** The four test channels of docs/10 section 3.3: the ids, names, numbers, categories and ladders it serves. */
const TEST_CHANNELS: Array<{ id: string; name: string; category: LiveCategory; number: string; variants: VariantName[] }> = [
  { id: "fx-news", name: "Fixture News", category: "News", number: "1", variants: ["360p", "720p"] },
  { id: "fx-sports", name: "Fixture Sports", category: "Sports", number: "2", variants: ["360p", "720p", "1080p"] },
  { id: "fx-music", name: "Fixture Music", category: "Music", number: "3", variants: ["360p", "720p"] },
  { id: "fx-kids", name: "Fixture Kids", category: "Kids", number: "4", variants: ["360p", "720p"] },
];

/** The refusal when the seed is asked for and the fixture files are not made. */
export const SEED_NEEDS_FIXTURES =
  "SEED_TEST_CHANNELS=true needs the fixture files in FIXTURE_DIR: run `npm run fixtures` from the repository root";

const SEED_ACTOR = { address: "seed" };
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** The fixture files a test channel plays: `live/<kind>-1.mp4` to `-3.mp4` (docs/10 section 2.1). */
const fixtureVideos = (fixtureDir: string, id: string) =>
  [1, 2, 3].map((n) => path.join(fixtureDir, "live", `${id.replace(/^fx-/, "")}-${n}.mp4`));

function liveInput(c: (typeof TEST_CHANNELS)[number], fixtureDir: string): LiveChannelInput {
  return { kind: "live", ...c, mode: "loop", captions: c.id === "fx-news", videos: fixtureVideos(fixtureDir, c.id) };
}

/**
 * Exactly the row the retired standalone live server's import left: a hand-untouched, enabled stream row whose
 * address is `http://<loopback>[:port]/live/<id>/master.m3u8`. Anything else, however it looks, is the owner's.
 */
function isLegacyTestRow(record: ChannelRecord | undefined, id: string): boolean {
  if (record?.kind !== "stream" || !record.enabled) return false;
  if (record.editedFields.length > 0 || record.playlistId !== null) return false;
  const address = URL.canParse(record.streamUrl) ? new URL(record.streamUrl) : undefined;
  return address !== undefined && LOOPBACK_HOSTS.has(address.hostname) && address.pathname === `/live/${id}/master.m3u8`;
}

/**
 * With `SEED_TEST_CHANNELS`, a backend with no channels creates the four test channels as live rows, each a
 * list of three fixture files from `fixtureDir` (made by scripts/fixtures/make-fixtures.mjs) and served by
 * this backend itself. News has captions. A live row stores no address.
 *
 * A database that predates the merge holds those ids as stream rows pointing at the retired live server's
 * port; each such legacy row (and only it) becomes the live row, keeping its id. A non-empty table gains no
 * new channels, and a row that is already live, was edited, or is shaped otherwise is never touched.
 */
export function seedTestChannels(channels: ChannelService, fixtureDir: string): { created: number; repaired: number } {
  const empty = channels.isEmpty();
  const repairs = empty ? [] : TEST_CHANNELS.filter((c) => isLegacyTestRow(channels.peek(c.id), c.id));
  if (!empty && repairs.length === 0) return { created: 0, repaired: 0 };
  const missing = TEST_CHANNELS.flatMap((c) => fixtureVideos(fixtureDir, c.id)).find((file) => !existsSync(file));
  if (missing !== undefined) throw new Error(`${SEED_NEEDS_FIXTURES} (${missing} is missing)`);
  if (empty) {
    for (const c of TEST_CHANNELS) channels.create(liveInput(c, fixtureDir), SEED_ACTOR, "");
    return { created: TEST_CHANNELS.length, repaired: 0 };
  }
  for (const c of repairs) channels.replaceStreamWithLive(liveInput(c, fixtureDir), SEED_ACTOR);
  return { created: 0, repaired: repairs.length };
}
