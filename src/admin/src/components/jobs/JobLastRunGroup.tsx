import { History, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { InlineLink } from "@giga/ui/controls/InlineLink";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { StateWord } from "@/components/records/StateWord";
import { LOADING_REASON } from "@/constants/account-copy";
import {
  COUNTS_TIP,
  CREATED_TIP,
  OUTCOME_TIP,
  REFUSED_TIP,
  RUN_STATE_TIP,
  STALE_TIP,
  TITLES_TIP,
  WHEN_TIP,
} from "@/constants/job-copy";
import { catalogCounts, countsLine, playlistCounts } from "@/lib/job-counts";
import { stateOfJob } from "@/lib/job-rows";
import { formatWhen } from "@/lib/format-when";
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
  /** Opens a created channel on the Channels tab. */
  readonly onOpenChannel: (id: string) => void;
}

/** `Last run` (`38` section 4.3), read-only. The State row ends with a `Refresh last run` icon (how a catalog run's end
 *  is learnt: nothing polls): State (the word, with the pulsing bar while running), When, Outcome; a playlist job's Counts, Refused (the
 *  refusal examples) and Created (each id a link to its channel); a catalog job's Titles and Stale. `lastCounts` is
 *  read defensively: an absent key is a shimmer line. */
export function JobLastRunGroup({ job, loading, onRefresh, onOpenChannel }: JobLastRunGroupProps) {
  const state = stateOfJob(job);
  const playlist = playlistCounts(job);
  const catalog = catalogCounts(job);
  const list = (items: readonly string[] | undefined, open?: (item: string) => void): ReactNode => {
    if (items === undefined || items.length === 0) return missing();
    return (
      <ul className="m-0 flex list-none flex-col gap-1 p-0 py-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-muted">
            {open === undefined ? item : <InlineLink onClick={() => open(item)}>{item}</InlineLink>}
          </li>
        ))}
      </ul>
    );
  };

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
        {fact(job.lastOutcome)}
      </Row>
      {job.type === "playlist" ? (
        <>
          <Row label="Counts" tip={COUNTS_TIP}>
            {fact(countsLine(playlist.counts))}
          </Row>
          <Row label="Refused" tip={REFUSED_TIP} align="start">
            {list(playlist.refused)}
          </Row>
          <Row label="Created" tip={CREATED_TIP} align="start">
            {list(playlist.created, onOpenChannel)}
          </Row>
        </>
      ) : (
        <>
          <Row label="Titles" tip={TITLES_TIP}>
            {fact(catalog.titles)}
          </Row>
          <Row label="Stale" tip={STALE_TIP}>
            {fact(catalog.stale)}
          </Row>
        </>
      )}
    </Group>
  );
}
