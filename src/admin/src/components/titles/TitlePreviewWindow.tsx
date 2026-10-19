import { useRef, useState } from "react";
import { workSpec } from "@giga/ui/lib/child-metrics";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { EmbedStage } from "@/components/records/EmbedStage";
import { PREVIEW_SIZE, TITLE_WINDOW_TITLE } from "@/constants/preview-copy";
import { LOADING_REASON, NO_PREVIEW_SOURCE, UNREACHABLE_REASON } from "@/constants/title-copy";
import { useTitlePreviewSession } from "@/hooks/useTitlePreviewSession";
import { useTitlePreviewVerbs } from "@/hooks/useTitlePreviewVerbs";
import { stopEmbedFrame } from "@/lib/embed-frame";
import { loadedRows, type StoredPaged } from "@/lib/title-paged";
import { findTitle } from "@/lib/title-rows";
import { resolvePreviewSource, titlePreviewTarget, titlePreviewWord } from "@/lib/title-preview-state";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { TitlePreviewToolbar } from "./TitlePreviewToolbar";

const SPEC = workSpec("title-preview", TITLE_WINDOW_TITLE, PREVIEW_SIZE);

/** The title's row wherever the app holds it: the Browse list's items, or a loaded page of the Stored list. */
const heldRow = (
  items: readonly AdminTitleRow[],
  paged: StoredPaged,
  titleId: string,
): AdminTitleRow | undefined =>
  findTitle(items, titleId) ?? loadedRows(paged).find((row) => row.id === titleId);

function TitlePreviewBody({ titleId }: { readonly titleId: string }) {
  const row = useAppStore((state) => heldRow(state.titles.items, state.titlesStored.paged, titleId));
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const session = useTitlePreviewSession(titleId);
  const verbs = useTitlePreviewVerbs(session.detail, session.gone, unreachable);
  const [chosen, setChosen] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const name = session.detail?.title ?? row?.title;
  const source = session.sources === undefined ? undefined : resolvePreviewSource(session.sources, chosen);
  const target = titlePreviewTarget(source);
  const word = titlePreviewWord(session.gone, session.reading, session.failed, session.sources ?? []);
  const frameTitle = `${name ?? TITLE_WINDOW_TITLE} player`;

  /* The title bar is the title (`36` section 8.2): its name - the held row's, or the detail's - a shimmer while the
     detail is read, and the `missing` word when it is gone. */
  const heading = name ?? (session.reading ? <span className={`${SHIMMER_TILE} block h-3.5 w-32`} aria-hidden /> : word);

  /* The status bar (`36` section 8.3): the state word left (a failure in the failure tone), the chosen source's name
     right, a shimmer while the sources are still unknown. */
  const bar = {
    left: (
      <span role="status" className={word === "failed" || word === "missing" ? "text-st-failed" : undefined}>
        {word}
      </span>
    ),
    right:
      source === undefined
        ? session.reading
          ? <span className={`${SHIMMER_TILE} h-3 w-24`} aria-hidden />
          : undefined
        : <span className="truncate">{source.name}</span>,
  };

  /* The only way the window closes: the frame blanks first (every request stops at once), then the flow ends. The
     request value stays until the next open raises its serial, so the window keeps its body through its exit fade. */
  const close = (): void => {
    stopEmbedFrame(frameRef.current);
    useAppStore.getState().closeOverlay();
  };

  const selectReason = session.reading
    ? LOADING_REASON
    : session.failed
      ? UNREACHABLE_REASON
      : source === undefined
        ? NO_PREVIEW_SOURCE
        : undefined;

  return (
    <ChildWindow
      spec={SPEC}
      onClose={close}
      heading={heading}
      label={name ?? TITLE_WINDOW_TITLE}
      status={bar}
    >
      <TitlePreviewToolbar
        verbs={verbs}
        rows={session.sources ?? []}
        value={source?.id}
        reason={selectReason}
        onChoose={setChosen}
      />
      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <EmbedStage frameRef={frameRef} target={target} skeleton={session.reading} label={frameTitle} />
      </div>
    </ChildWindow>
  );
}

/** The title preview window (`55` decision 8), the channels preview's shape: a modal work window that plays ONE title in
 *  an iframe - a movie one of its own detail sources, a series one of its FIRST episode's sources (the existing seasons
 *  read), the backend's first by default. The `Provider` select changes the source, the "change the provider source"
 *  the owner asked for. The title bar is the title's name; the toolbar carries its `Enabled` switch and the select; the
 *  status bar carries the state word and the chosen source's name; the stage fills the rest. The window's player policy
 *  follows the chosen source's `origin`/`frameOrigins` while it is open and is cleared when it closes. Opened by a
 *  stored title row's eye and the Titles workspace's `Preview →` (a saved title with a TMDB id only). */
export function TitlePreviewWindow() {
  const preview = useAppStore((state) => state.titles.preview);
  return preview === null ? null : <TitlePreviewBody key={preview.opened} titleId={preview.titleId} />;
}