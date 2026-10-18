import type { JobProgress } from "@/services/schemas/job-event-schema";

/* A running job's phase and counts in words, for the statusbar's tooltip (`44` section 4): `Checking streams 1,204 of
 * 2,598`, `Walking movies 12 of 100 pages`, `Caching logos 40 of 312`. A phase whose total is not known yet says only the
 * phase. Pure. */
const PHASE_WORDS: Readonly<Record<string, string>> = {
  reading: "Reading the playlist",
  logos: "Caching logos",
  checking: "Checking streams",
  movies: "Walking movies",
  tv: "Walking series",
};
const PAGE_PHASES: ReadonlySet<string> = new Set(["movies", "tv", "list"]);
const FALLBACK_WORD = "Walking titles";

const whole = (value: number): string => value.toLocaleString("en-US");

export function progressWords({ phase, done, total }: Pick<JobProgress, "phase" | "done" | "total">): string {
  const word = PHASE_WORDS[phase] ?? FALLBACK_WORD;
  if (total <= 0 || phase === "reading") return word;
  return `${word} ${whole(done)} of ${whole(total)}${PAGE_PHASES.has(phase) || !(phase in PHASE_WORDS) ? " pages" : ""}`;
}
