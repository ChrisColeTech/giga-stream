import { ADD_VIDEO_DUPLICATE, ADD_VIDEO_EMPTY, ALREADY_FIRST, ALREADY_LAST } from "@/constants/channel-copy";

/* A live channel's ordered list of videos (`36` section 6, `VideoList`): pure moves over a list of paths. Every function
 * returns a new list; the order is the play order. */

/** The list with the video at `index` moved one place up (`-1`) or down (`1`); unchanged at an end. */
export function moveVideo(videos: readonly string[], index: number, step: -1 | 1): string[] {
  const to = index + step;
  if (index < 0 || index >= videos.length || to < 0 || to >= videos.length) return [...videos];
  const next = [...videos];
  const [moved] = next.splice(index, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

export const removeVideo = (videos: readonly string[], index: number): string[] => videos.filter((_, at) => at !== index);

/** Why a path cannot be added: empty, or already in the list; undefined when it can. */
export function addReason(videos: readonly string[], path: string): string | undefined {
  const text = path.trim();
  if (text === "") return ADD_VIDEO_EMPTY;
  return videos.includes(text) ? ADD_VIDEO_DUPLICATE : undefined;
}

/** The list with the trimmed path at its end; unchanged when the path cannot be added. */
export const addVideo = (videos: readonly string[], path: string): string[] =>
  addReason(videos, path) === undefined ? [...videos, path.trim()] : [...videos];

export const upReason = (index: number): string | undefined => (index === 0 ? ALREADY_FIRST : undefined);

export const downReason = (index: number, length: number): string | undefined =>
  index === length - 1 ? ALREADY_LAST : undefined;
