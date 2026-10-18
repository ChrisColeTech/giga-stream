import { workSpec } from "@giga/ui/lib/child-metrics";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { PREVIEW_SIZE, PREVIEW_TITLE } from "@/constants/preview-copy";
import { usePreviewKeys } from "@/hooks/usePreviewKeys";
import { usePreviewNotice } from "@/hooks/usePreviewNotice";
import { usePreviewPlayer } from "@/hooks/usePreviewPlayer";
import { usePreviewSession } from "@/hooks/usePreviewSession";
import { usePreviewVerbs } from "@/hooks/usePreviewVerbs";
import { usePreviewWalk } from "@/hooks/usePreviewWalk";
import { previewLine, previewTarget } from "@/lib/preview-state";
import { useAppStore } from "@/store/app-store";
import { PreviewStage } from "./PreviewStage";
import { PreviewToolbar } from "./PreviewToolbar";

const SPEC = workSpec("preview", PREVIEW_TITLE, PREVIEW_SIZE);

function PreviewBody({ channelId }: { readonly channelId: string }) {
  const session = usePreviewSession(channelId);
  const target = previewTarget(session.channel, session.reading);
  const player = usePreviewPlayer(target.address, session.attempt);
  const status = previewLine(session.channel, session.reading, player.status);
  usePreviewNotice(status.notice);
  const closeOverlay = useAppStore((state) => state.closeOverlay);
  const walk = usePreviewWalk(player.detach, session.reading);
  const verbs = usePreviewVerbs(session.channel, session.reading, player.status.error !== null);
  usePreviewKeys(walk.step);

  /* The title bar is the channel (`36` section 8.2): its name, a shimmer while it is read, never the word `Preview`. */
  const name = session.channel?.name;
  const shimmer = <span className={`${SHIMMER_TILE} block h-3.5 w-32`} aria-hidden />;
  const heading = name ?? (session.reading ? shimmer : status.line);

  /* The window's state is its status bar (`36` section 8.3): the state word left (a failure in the failure tone), the
     position right, a shimmer while the window reads. */
  const place = session.reading && walk.position === null ? null : `${walk.position ?? "–"} / ${walk.total}`;
  const bar = {
    left: (
      <span role="status" className={status.line.startsWith("failed") ? "text-st-failed" : undefined}>
        {status.line}
      </span>
    ),
    right:
      place === null ? (
        <span className={`${SHIMMER_TILE} h-3 w-10`} aria-hidden />
      ) : (
        <span className="font-mono tabular-nums text-faint">{place}</span>
      ),
  };

  /* The only way the window closes: every request stops first, then the flow ends. The request value stays until the
     next open raises its serial, so the window keeps its body through its exit fade. */
  const close = (): void => {
    player.detach();
    closeOverlay();
  };

  return (
    <ChildWindow spec={SPEC} onClose={close} heading={heading} label={name ?? PREVIEW_TITLE} status={bar}>
      <PreviewToolbar
        walk={walk}
        retry={status.retry}
        onRetry={session.retry}
        verbs={verbs}
      />
      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <PreviewStage videoRef={player.videoRef} skeleton={target.skeleton} />
      </div>
    </ChildWindow>
  );
}

/** The Preview window (`36` section 8, 8.1): a modal work window that plays one saved channel through hls.js, a live channel
 *  on its own `/live/<id>/` path and a stream channel on its address. The title bar is the channel's name (8.2); a toolbar
 *  under it carries `Enable` / `Disable`, `Mark live` / `Mark dead`, `Retry` and, right, the state word and the walk
 *  (`N / total`, `Previous`, `Next`); the stage fills the rest. It reads ONE channel, never the list. Moved by its header, resized by its edges, closed by its X or Escape, its bounds remembered
 *  for the run. Each open reads the channels afresh; a step of the walk moves the request value (a new serial) and keeps
 *  the window mounted, so it stays at its place and size: the player detaches, then attaches the next channel. */
export function PreviewWindow() {
  const preview = useAppStore((state) => state.channels.preview);
  return preview === null ? null : <PreviewBody key={preview.opened} channelId={preview.channelId} />;
}
