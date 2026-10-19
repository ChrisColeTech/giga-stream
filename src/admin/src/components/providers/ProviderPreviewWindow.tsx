import { useRef, useState } from "react";
import { workSpec } from "@giga/ui/lib/child-metrics";
import { SHIMMER_TILE } from "@giga/ui/lib/shimmer";
import { ChildWindow } from "@giga/ui/windows/ChildWindow";
import { EmbedStage } from "@/components/records/EmbedStage";
import { LOADING_REASON, NO_PREVIEW_TITLE, UNREACHABLE_REASON } from "@/constants/provider-copy";
import { PREVIEW_SIZE, PROVIDER_WINDOW_TITLE } from "@/constants/preview-copy";
import { useProviderPreviewTitles } from "@/hooks/useProviderPreviewTitles";
import { useProviderPreviewVerbs } from "@/hooks/useProviderPreviewVerbs";
import { stopEmbedFrame } from "@/lib/embed-frame";
import {
  previewTitleRows,
  providerPreviewTarget,
  providerPreviewWord,
  resolvePreviewTitle,
} from "@/lib/provider-preview-state";
import { findProvider } from "@/lib/provider-rows";
import { useAppStore } from "@/store/app-store";
import { ProviderPreviewToolbar } from "./ProviderPreviewToolbar";

const SPEC = workSpec("provider-preview", PROVIDER_WINDOW_TITLE, PREVIEW_SIZE);

function ProviderPreviewBody({ providerId }: { readonly providerId: number }) {
  const provider = useAppStore((state) => findProvider(state.providers.items, providerId));
  const unreachable = useAppStore((state) => state.providers.unreachable);
  const titles = useProviderPreviewTitles();
  const verbs = useProviderPreviewVerbs(provider, unreachable);
  const [chosen, setChosen] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const title = resolvePreviewTitle(titles.rows, chosen);
  const target = providerPreviewTarget(provider, title);
  const word = providerPreviewWord(provider, titles.reading, titles.failed, target);
  const frameTitle = `${provider?.name ?? PROVIDER_WINDOW_TITLE} player`;

  /* The title bar is the provider (`36` section 8.2): its name from the held list (the window opens from a held row),
     and the `missing` word when it is gone. */
  const heading = provider?.name ?? word;

  /* The status bar (`36` section 8.3): the state word left (a failure in the failure tone), the chosen title's name
     right, a shimmer while the titles are read. */
  const bar = {
    left: (
      <span role="status" className={word === "failed" || word === "missing" ? "text-st-failed" : undefined}>
        {word}
      </span>
    ),
    right:
      title === undefined
        ? titles.reading
          ? <span className={`${SHIMMER_TILE} h-3 w-24`} aria-hidden />
          : undefined
        : <span className="truncate">{title.title}</span>,
  };

  /* The only way the window closes: the frame blanks first (every request stops at once), then the flow ends. The
     request value stays until the next open raises its serial, so the window keeps its body through its exit fade. */
  const close = (): void => {
    stopEmbedFrame(frameRef.current);
    useAppStore.getState().closeOverlay();
  };

  /* The `Title` select, like the switch beside it, waits while the backend cannot be reached: the titles it offers are
     the backend's own rows. Otherwise it waits while the stored titles are read, says a failed read, and says when no
     held stored movie can fill the template. */
  const selectReason = unreachable
    ? UNREACHABLE_REASON
    : titles.reading
      ? LOADING_REASON
      : titles.failed
        ? UNREACHABLE_REASON
        : title === undefined
          ? NO_PREVIEW_TITLE
          : undefined;

  return (
    <ChildWindow
      spec={SPEC}
      onClose={close}
      heading={heading}
      label={provider?.name ?? PROVIDER_WINDOW_TITLE}
      status={bar}
    >
      <ProviderPreviewToolbar
        verbs={verbs}
        rows={previewTitleRows(titles.rows)}
        value={title?.id}
        reason={selectReason}
        onChoose={setChosen}
      />
      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <EmbedStage frameRef={frameRef} target={target} skeleton={titles.reading} label={frameTitle} />
      </div>
    </ChildWindow>
  );
}

/** The provider preview window (`55` decision 7), the channels preview's shape: a modal work window that plays ONE
 *  provider's embed in an iframe - its movie template filled with the TMDB id of a stored movie the `Title` select
 *  chooses, the first such title by default. The title bar is the provider's name; the toolbar carries its `Enabled`
 *  switch and the select; the status bar carries the state word and the chosen title's name; the stage fills the rest.
 *  The window's player policy (the backend Electron host's frame guard) allows exactly the chosen address's origins
 *  while it is open and is cleared when it closes. Opened by a provider row's eye and the Providers workspace's
 *  `Preview →` (a saved provider only). */
export function ProviderPreviewWindow() {
  const preview = useAppStore((state) => state.providers.preview);
  return preview === null ? null : <ProviderPreviewBody key={preview.opened} providerId={preview.providerId} />;
}