/** The colour families a poster's fallback can take. Each is a swatch token defined in index.css, so no hex appears here. */
export const POSTER_TONES = ["--color-sw-amber", "--color-sw-blue", "--color-sw-green", "--color-sw-violet", "--color-sw-rose"] as const;

export type PosterTone = (typeof POSTER_TONES)[number];

/** A stable tone for a title: the same title always gets the same family, and the families spread across a library. */
export function posterTone(title: string): PosterTone {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return POSTER_TONES[hash % POSTER_TONES.length] ?? POSTER_TONES[0];
}
