import { workSpec } from "@giga/ui/lib/child-metrics";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { PREVIEW_SIZE, PREVIEW_TITLE } from "@/constants/preview-copy";
import { usePreviewPlayer } from "@/hooks/usePreviewPlayer";
import { usePreviewSession } from "@/hooks/usePreviewSession";
import { previewLine, previewTarget } from "@/lib/preview-state";
import { useAppStore } from "@/store/app-store";
import { PreviewStage } from "./PreviewStage";
import { PreviewStatus } from "./PreviewStatus";

const SPEC = workSpec("preview", PREVIEW_TITLE, PREVIEW_SIZE);

function PreviewBody({ channelId }: { readonly channelId: string }) {
  const session = usePreviewSession(channelId);
  const target = previewTarget(session.channel, session.reading);
  const player = usePreviewPlayer(target.address, session.attempt);
  const status = previewLine(session.channel, session.reading, player.status);
  const closeOverlay = useAppStore((state) => state.closeOverlay);

  /* The only way the window closes: every request stops first, then the flow ends. The request value stays until the
     next open raises its serial, so the window keeps its body through its exit fade. */
  const close = (): void => {
    player.detach();
    closeOverlay();
  };

  return (
    <ChildWindow spec={SPEC} onClose={close}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <PreviewStage videoRef={player.videoRef} skeleton={target.skeleton} />
        <PreviewStatus line={status.line} retry={status.retry} onRetry={session.retry} />
      </div>
    </ChildWindow>
  );
}

/** The Preview window (`36` section 8, `26` 4.5a): a modal work window that plays one saved channel through hls.js, a live
 *  channel on its own `/live/<id>/` path and a stream channel on its address, with one status line and `Retry`. Moved by
 *  its header, resized by its edges, closed by its X or Escape, its bounds remembered for the run. Each open (a new
 *  serial) reads the channel afresh. */
export function PreviewWindow() {
  const preview = useAppStore((state) => state.channels.preview);
  return preview === null ? null : <PreviewBody key={preview.serial} channelId={preview.channelId} />;
}
