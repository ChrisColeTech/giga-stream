/* The notices of the statusbar's Stop (`44` section 4), in the voice of the Jobs notices (`Stopping <name>.`). A clean
 * stop says nothing (`50` section 2.1): the readout and the Stop state carry it; only a refusal is said. */
const syncs = (count: number): string => `${count} ${count === 1 ? "sync" : "syncs"}`;

/** Some or all of the stop calls were refused; `sentence` is the first refusal's own words. */
export const stopRefused = (failed: number, total: number, sentence: string): string =>
  failed === total
    ? `Could not stop ${syncs(total)}: ${sentence}`
    : `Stopping ${total - failed} of ${syncs(total)}; ${failed} could not be stopped: ${sentence}`;
