import { workSpec } from "@giga/ui/lib/child-metrics";
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

  /* The only way the window closes: every request stops first, then the flow ends. The request value stays until the
     next open raises its serial, so the window keeps its body through its exit fade. */
  const close = (): void => {
    player.detach();
    closeOverlay();
  };

  return (
    <ChildWindow spec={SPEC} onClose={close}>
      <PreviewToolbar
        name={session.channel?.name}
        reading={session.reading}
        walk={walk}
        line={status.line}
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
 *  on its own `/live/<id>/` path and a stream channel on its address. A toolbar under the header carries the walk
 *  (`Previous`, `Next`, `N / total`), the name and state word, `Enable` / `Disable`, `Mark live` / `Mark dead` and `Retry`;
 *  the stage fills the rest. Moved by its header, resized by its edges, closed by its X or Escape, its bounds remembered
 *  for the run. Each open reads the channels afresh; a step of the walk moves the request value (a new serial) and keeps
 *  the window mounted, so it stays at its place and size: the player detaches, then attaches the next channel. */
export function PreviewWindow() {
  const preview = useAppStore((state) => state.channels.preview);
  return preview === null ? null : <PreviewBody key={preview.opened} channelId={preview.channelId} />;
}
