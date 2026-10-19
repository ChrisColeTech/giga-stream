import { isTicked, selectedCount } from "@giga/ui/lib/list-selection";
import { PREVIEW_CHANNEL_TOOLTIP, PREVIEW_LABEL } from "@/constants/preview-copy";
import { PREVIEW_PROVIDER_TOOLTIP } from "@/constants/provider-copy";
import { PREVIEW_TITLE_TOOLTIP } from "@/constants/title-copy";
import { previewIndexReason } from "@/lib/channel-guard";
import { loadedRows } from "@/lib/title-paged";
import { providerPreviewReason } from "@/lib/provider-rows";
import { titlePreviewReason } from "@/lib/title-rows";
import type { ToolbarVerb } from "@/lib/workspace-verbs";
import { useAppStore } from "@/store/app-store";
import { usePreviewOpen } from "./usePreviewOpen";
import { useProviderPreviewOpen } from "./useProviderPreviewOpen";
import { useTitlePreviewOpen } from "./useTitlePreviewOpen";

export type PreviewIndex = "channels" | "providers" | "titles";

/** The three index Preview promotes. Each acts on exactly one ticked, previewable row and opens the existing window. */
export function useIndexPreviewPromote(index: PreviewIndex): ToolbarVerb {
  const channels = useAppStore((state) => state.channels);
  const providers = useAppStore((state) => state.providers);
  const titles = useAppStore((state) => state.titles);
  const stored = useAppStore((state) => state.titlesStored);
  const openChannel = usePreviewOpen();
  const openProvider = useProviderPreviewOpen();
  const openTitle = useTitlePreviewOpen();

  if (index === "channels") {
    const id = channels.ticked.length === 1 ? channels.ticked[0] : undefined;
    return { label: PREVIEW_LABEL, tip: PREVIEW_CHANNEL_TOOLTIP, reason: previewIndexReason(channels.ticked.length),
      onPress: () => { if (id !== undefined) openChannel(id); } };
  }
  if (index === "providers") {
    const id = providers.ticked.length === 1 ? providers.ticked[0] : undefined;
    return { label: PREVIEW_LABEL, tip: PREVIEW_PROVIDER_TOOLTIP,
      reason: providerPreviewReason(providers.ticked, providers.items, providers.unreachable),
      onPress: () => { if (id !== undefined) openProvider(id); } };
  }
  const browse = stored.mode === "browse";
  const count = browse ? titles.ticked.length : selectedCount(stored.selection, stored.paged.total ?? 0);
  const selected = browse
    ? titles.items.find((item) => titles.ticked.includes(item.id))
    : Object.values(stored.picked)[0] ?? loadedRows(stored.paged).find((item) => isTicked(stored.selection, item.id));
  const row = browse && selected?.stored !== true ? undefined : selected;
  return { label: PREVIEW_LABEL, tip: PREVIEW_TITLE_TOOLTIP,
    reason: titlePreviewReason(count, row, browse ? titles.unreachable : stored.unreachable),
    onPress: () => { if (row !== undefined) openTitle(row.id); } };
}
