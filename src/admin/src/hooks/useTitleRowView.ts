import { createElement } from "react";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { TitleDeleteButton } from "@/components/titles/TitleDeleteButton";
import { titleStateOf } from "@/lib/title-rows";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import { useTitleActions } from "./useTitleActions";

/** What a Titles row says about itself, the same in the Stored list and the TMDB browse list (`37` section 4.2): its
 *  state and dimming, its tick (the list passes how a tick is written), the press that opens the workspace and the
 *  end `Delete`. */
export function useTitleRowView(unreachable: boolean): (
  title: AdminTitleRow,
  ticked: boolean,
  onTick: (on: boolean) => void,
) => RecordRowView {
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const { flows, saving, isBusy, track } = useTitleActions();
  return (title, ticked, onTick) => {
    const state = titleStateOf(title);
    return {
      state: state.word,
      dimmed: state.dimmed,
      ticked,
      tick: { label: `Select ${title.title}`, onToggle: onTick },
      onOpen: () => openWorkspace("titles", title.id),
      end: createElement(TitleDeleteButton, {
        title,
        busy: saving || isBusy(`delete:${title.id}`),
        unreachable,
        onDelete: () => void track(`delete:${title.id}`, () => flows.remove(title.id)),
      }),
    };
  };
}
