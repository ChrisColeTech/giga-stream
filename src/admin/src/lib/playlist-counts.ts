import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

const num = (value: number): string => value.toLocaleString("en-US");

/** The Status counts line of a playlist: `2,598 channels · 0 enabled · 1,904 live · 640 dead`. */
export function countsText(playlist: AdminPlaylist): string {
  const noun = playlist.channels === 1 ? "channel" : "channels";
  return [
    `${num(playlist.channels)} ${noun}`,
    `${num(playlist.enabledChannels)} enabled`,
    `${num(playlist.live)} live`,
    `${num(playlist.dead)} dead`,
  ].join(" · ");
}
