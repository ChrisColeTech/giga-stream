import { existsSync } from "node:fs";
import path from "node:path";

import type { VariantName } from "../constants/live-media.js";
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

/** The fixture files a test channel plays: `live/<kind>-1.mp4` to `-3.mp4` (docs/10 section 2.1). */
const fixtureVideos = (fixtureDir: string, id: string) =>
  [1, 2, 3].map((n) => path.join(fixtureDir, "live", `${id.replace(/^fx-/, "")}-${n}.mp4`));

/**
 * With `SEED_TEST_CHANNELS`, a backend with no channels creates the four test channels as live rows, each a
 * list of three fixture files from `fixtureDir` (made by scripts/fixtures/make-fixtures.mjs) and served by
 * this backend itself. News has captions. Needs no `ALLOW_LOOPBACK_STREAMS`: a live row stores no address.
 */
export function seedTestChannels(channels: ChannelService, fixtureDir: string): number {
  if (!channels.isEmpty()) return 0;
  const missing = TEST_CHANNELS.flatMap((c) => fixtureVideos(fixtureDir, c.id)).find((file) => !existsSync(file));
  if (missing !== undefined) throw new Error(`${SEED_NEEDS_FIXTURES} (${missing} is missing)`);
  for (const c of TEST_CHANNELS) {
    channels.create(
      { kind: "live", ...c, mode: "loop", captions: c.id === "fx-news", videos: fixtureVideos(fixtureDir, c.id) },
      { address: "seed" },
      "",
    );
  }
  return TEST_CHANNELS.length;
}
