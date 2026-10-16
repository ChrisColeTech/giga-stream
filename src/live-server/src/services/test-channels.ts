import { existsSync } from "node:fs";
import path from "node:path";

import type { VariantName } from "../constants/media.ts";
import type { Category } from "../types/channel.ts";
import type { ChannelService } from "./channel-service.ts";

/** The four test channels of docs/10 section 3.2: the ids, names, numbers and categories the backend seeds. */
const TEST_CHANNELS: Array<{ id: string; name: string; category: Category; number: number; variants: VariantName[] }> = [
  { id: "fx-news", name: "Fixture News", category: "News", number: 1, variants: ["360p", "720p"] },
  { id: "fx-sports", name: "Fixture Sports", category: "Sports", number: 2, variants: ["360p", "720p", "1080p"] },
  { id: "fx-music", name: "Fixture Music", category: "Music", number: 3, variants: ["360p", "720p"] },
  { id: "fx-kids", name: "Fixture Kids", category: "Kids", number: 4, variants: ["360p", "720p"] },
];

/** The refusal when the seed is asked for and the fixture files are not made. */
export const SEED_NEEDS_FIXTURES =
  "SEED_TEST_CHANNELS=true needs the fixture files in FIXTURE_DIR: run `npm run fixtures` from the repository root";

/** The fixture files a test channel plays: `live/<kind>-1.mp4` to `-3.mp4` (docs/10 section 2.1). */
const fixtureVideos = (fixtureDir: string, id: string) =>
  [1, 2, 3].map((n) => path.join(fixtureDir, "live", `${id.replace(/^fx-/, "")}-${n}.mp4`));

/**
 * With `SEED_TEST_CHANNELS`, a live server with no channels creates the four test channels, each a list of
 * three fixture files from `fixtureDir` (made by scripts/fixtures/make-fixtures.mjs). News has captions.
 */
export function seedTestChannels(channels: ChannelService, fixtureDir: string): number {
  if (channels.count() > 0) return 0;
  const missing = TEST_CHANNELS.flatMap((c) => fixtureVideos(fixtureDir, c.id)).find((file) => !existsSync(file));
  if (missing !== undefined) throw new Error(`${SEED_NEEDS_FIXTURES} (${missing} is missing)`);
  for (const c of TEST_CHANNELS) {
    channels.create({ ...c, mode: "loop", captions: c.id === "fx-news", videos: fixtureVideos(fixtureDir, c.id) }, "");
  }
  return TEST_CHANNELS.length;
}
