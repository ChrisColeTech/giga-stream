import { createElement } from "react";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { TitleActions } from "@/components/titles/TitleActions";
import { titleStateOf } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { useTitlePreviewOpen } from "./useTitlePreviewOpen";
import { useTitleActions } from "./useTitleActions";

/** What a Titles row says about itself, the same in the Stored list and the TMDB browse list (`37` section 4.2): its
 *  state and dimming, its tick (the list passes how a tick is written), the press that opens the workspace and the end
 *  `Preview` eye (a title with a TMDB id only, `55` decision 4) beside the armed `Delete`. */
export function useTitleRowView(unreachable: boolean): (
  title: AdminTitleRow,
  ticked: boolean,
  onTick: (on: boolean) => void,
) => RecordRowView {
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const openPreview = useTitlePreviewOpen();
  const { flows, saving, isBusy, track } = useTitleActions();
  return (title, ticked, onTick) => {
    const state = titleStateOf(title);
    return {
      state: state.word,
      dimmed: state.dimmed,
      ticked,
      tick: { label: `Select ${title.title}`, onToggle: onTick },
      onOpen: () => openWorkspace("titles", title.id),
      end: createElement(TitleActions, {
        title,
        busy: saving || isBusy(`delete:${title.id}`),
        unreachable,
        onPreview: openPreview,
        onDelete: () => void track(`delete:${title.id}`, () => flows.remove(title.id)),
      }),
    };
  };
}
