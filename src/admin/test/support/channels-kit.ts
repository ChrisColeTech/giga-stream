import type { LiveAdminChannel, StreamAdminChannel } from "@/types/admin-channel";

/* Channel rows in the backend's own wire shape (`29` section 5), for the Channels wave's tests. Test data only: the app
 * never holds a channel it did not read from the backend. */

export const live = (id: string, overrides: Partial<LiveAdminChannel> = {}): LiveAdminChannel => ({
  id,
  name: `Channel ${id}`,
  category: "News",
  logoUrl: `http://127.0.0.1:5172/logos/${id}.png`,
  streamUrl: `http://127.0.0.1:5172/live/${id}/master.m3u8`,
  kind: "live",
  revision: 1,
  enabled: true,
  mode: "loop",
  captions: false,
  variants: ["360p", "720p"],
  folder: "D:\\videos\\news",
  state: "live",
  renditions: ["360p", "720p"],
  playlist: [
    { name: "a.mp4", durationMs: 42_000 },
    { name: "b.mp4", durationMs: 61_500 },
  ],
  nowPlaying: { index: 1, name: "b.mp4" },
  ...overrides,
});

export const stream = (id: string, overrides: Partial<StreamAdminChannel> = {}): StreamAdminChannel => ({
  id,
  name: `Stream ${id}`,
  category: "Sports",
  streamUrl: `https://tv.example/${id}.m3u8`,
  kind: "stream",
  revision: 2,
  enabled: true,
  ...overrides,
});

/** The JSON a list answer carries. */
export const listOf = (items: readonly unknown[], revision = 9) => ({ items, revision });
