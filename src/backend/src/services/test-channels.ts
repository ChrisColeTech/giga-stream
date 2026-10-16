import type { ChannelService } from "./channel-service.js";

/** The streaming test server's address (docs/10, docs/03 section 7.7). */
const TEST_SERVER = "http://127.0.0.1:8097";

/** The four channels of docs/10 section 3.2, with the ids, names, numbers and categories it serves. */
const TEST_CHANNELS = [
  { id: "fx-news", name: "Fixture News", category: "News", number: "1" },
  { id: "fx-sports", name: "Fixture Sports", category: "Sports", number: "2" },
  { id: "fx-music", name: "Fixture Music", category: "Music", number: "3" },
  { id: "fx-kids", name: "Fixture Kids", category: "Kids", number: "4" },
] as const;

/** With `SEED_TEST_CHANNELS`, a backend with no channels creates the four test channels. */
export function seedTestChannels(channels: ChannelService): number {
  if (!channels.isEmpty()) return 0;
  for (const c of TEST_CHANNELS) {
    channels.create(
      {
        name: c.name,
        category: c.category,
        number: c.number,
        streamUrl: `${TEST_SERVER}/live/${c.id}/master.m3u8`,
        logoUrl: `${TEST_SERVER}/logos/${c.id}.png`,
      },
      { address: "seed" },
      c.id,
    );
  }
  return TEST_CHANNELS.length;
}

/** The refusal when the seed is asked for without the loopback flag (docs/03 section 7.7). */
export const SEED_NEEDS_LOOPBACK =
  "SEED_TEST_CHANNELS=true needs ALLOW_LOOPBACK_STREAMS=true: the test channels point at the streaming " +
  "test server on http://127.0.0.1:8097.";
