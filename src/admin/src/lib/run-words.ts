import { ERROR_SENTENCES } from "@/constants/api-sentences";
import type { RunCounts, RunResult } from "@/services/schemas/run-counts-schema";
import { catalogCountsOf, failedCountsOf, playlistCountsOf } from "./job-counts";

/* A sync run worded in the admin from its typed result (`43` section 3.4 step 6): the backend stores no sentence. Only
 * what the counts hold is said, and a count of nothing is left out: `Synced: 312 logos cached, 1,904 live, 640 dead.`
 * A run that changed nothing reads `Synced: nothing changed.` A failure names its code through the error table. Pure. */

const PREFIX: Readonly<Record<RunResult, string>> = { ok: "Synced", failed: "Failed", stopped: "Stopped" };

const number = (value: number): string => value.toLocaleString("en-US");

function parts(counts: RunCounts): string[] {
  const playlist = playlistCountsOf(counts);
  if (playlist !== undefined) {
    const found: ReadonlyArray<readonly [number, string]> = [
      [playlist.created, "created"],
      [playlist.updated, "updated"],
      [playlist.skipped, "skipped"],
      [playlist.refused, "refused"],
      [playlist.logosCached, "logos cached"],
      [playlist.logosFailed, "logos failed"],
      [playlist.live, "live"],
      [playlist.dead, "dead"],
      [playlist.unchecked, "not checked"],
    ];
    const said = found.filter(([count]) => count > 0).map(([count, word]) => `${number(count)} ${word}`);
    return playlist.source === "unreachable" ? [...said, "web list unreachable"] : said;
  }
  const catalog = catalogCountsOf(counts);
  if (catalog === undefined) return [];
  const found: ReadonlyArray<readonly [number | undefined, string]> = [
    [catalog.titles, "titles"],
    [catalog.changed, "changed"],
    [catalog.detailed, "details"],
    [catalog.seasons, "seasons"],
    [catalog.enriched, "enriched"],
    [catalog.stale, "stale"],
  ];
  return found.flatMap(([count, word]) => (count !== undefined && count > 0 ? [`${number(count)} ${word}`] : []));
}

/** The run's words, or undefined when it never ran (no result, no counts). */
export function runWords(result: RunResult | undefined, counts: RunCounts | undefined): string | undefined {
  if (result === undefined && counts === undefined) return undefined;
  const failed = failedCountsOf(counts);
  if (result === "failed" || failed !== undefined) {
    const code = failed?.code;
    return `Failed: ${code === undefined ? "no reason recorded" : (ERROR_SENTENCES[code] ?? code)}`;
  }
  const said = counts === undefined ? [] : parts(counts);
  const wasStopped = counts !== undefined && "stopped" in counts && counts.stopped === true;
  return `${PREFIX[wasStopped ? "stopped" : (result ?? "ok")]}: ${said.length === 0 ? "nothing changed" : said.join(", ")}.`;
}
