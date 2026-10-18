import { History, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { StateWord } from "@/components/records/StateWord";
import { LOADING_REASON } from "@/constants/account-copy";
import {
  COUNTS_TIP,
  DETAILS_TIP,
  JOB_SOURCE_TIP,
  OUTCOME_TIP,
  REFUSED_TIP,
  RUN_STATE_TIP,
  SEASONS_TIP,
  STALE_TIP,
  TITLES_TIP,
  WHEN_TIP,
} from "@/constants/job-copy";
import { SOURCE_WORDS, catalogCountsOf, countsLine, playlistCountsOf, refusalsOf } from "@/lib/job-counts";
import { stateOfJob } from "@/lib/job-rows";
import { formatWhen } from "@/lib/format-when";
import { runWords } from "@/lib/run-words";
import type { AdminJob } from "@/services/schemas/job-schema";
import { RunningBar } from "./RunningBar";

const FACT = "flex min-h-9 min-w-0 items-center py-2 font-mono text-sm text-muted";

/** A fact the last run did not leave: a shimmer line in its place, never a sentence. */
const missing = (): ReactNode => (
  <span className="flex h-9 w-full items-center" aria-hidden>
    <span className={SHIMMER} style={{ width: "38%" }} />
  </span>
);

const fact = (value: string | number | undefined): ReactNode =>
  value === undefined ? missing() : <span className={FACT}>{value}</span>;

export interface JobLastRunGroupProps {
  readonly job: AdminJob;
  readonly loading: boolean;
  readonly onRefresh: () => void;
}

/** `Last run` (`38` section 4.3, `43` section 4.1), read-only. The State row ends with a `Refresh last run` icon (how a
 *  run's end is learnt: a run is started, not awaited, and nothing polls): State (the word, with the pulsing bar while
 *  running), When, Outcome (the run in words, built here from the typed result); a playlist job's Counts, Source (what
 *  the run did about the playlist's own list) and Refused (the refusal examples, names only); a catalog job's Titles and
 *  Stale. The counts are typed; one a run did not leave is a shimmer line. */
export function JobLastRunGroup({ job, loading, onRefresh }: JobLastRunGroupProps) {
  const state = stateOfJob(job);
  const playlist = playlistCountsOf(job.lastCounts);
  const catalog = catalogCountsOf(job.lastCounts);
  const refused = playlist === undefined ? [] : refusalsOf(playlist);

  return (
    <Group id="jw-last" icon={History} title="Last run" last>
      <Row
        label="State"
        tip={RUN_STATE_TIP}
        trailing={
          <IconButton
            aria-label="Refresh last run"
            title="Refresh last run"
            reason={loading ? LOADING_REASON : undefined}
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" aria-hidden />
          </IconButton>
        }
      >
        <span className="flex h-9 items-center gap-2">
          <StateWord state={state} />
          {state.word === "running" && <RunningBar />}
        </span>
      </Row>
      <Row label="When" tip={WHEN_TIP}>
        {fact(formatWhen(job.lastRunAt))}
      </Row>
      <Row label="Outcome" tip={OUTCOME_TIP}>
        {fact(runWords(job.lastResult, job.lastCounts))}
      </Row>
      {job.type === "playlist" ? (
        <>
          <Row label="Counts" tip={COUNTS_TIP}>
            {fact(playlist === undefined ? undefined : countsLine(playlist))}
          </Row>
          <Row label="Source" tip={JOB_SOURCE_TIP}>
            {fact(playlist === undefined ? undefined : SOURCE_WORDS[playlist.source])}
          </Row>
          <Row label="Refused" tip={REFUSED_TIP} align="start">
            {refused.length === 0 ? (
              missing()
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 py-2">
                {refused.map((item) => (
                  <li key={item} className="text-sm text-muted">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </Row>
        </>
      ) : (
        <>
          <Row label="Titles" tip={TITLES_TIP}>
            {fact(catalog?.titles)}
          </Row>
          <Row label="Details" tip={DETAILS_TIP}>
            {fact(catalog?.detailed)}
          </Row>
          <Row label="Seasons" tip={SEASONS_TIP}>
            {fact(catalog?.seasons)}
          </Row>
          <Row label="Stale" tip={STALE_TIP}>
            {fact(catalog?.stale)}
          </Row>
        </>
      )}
    </Group>
  );
}
