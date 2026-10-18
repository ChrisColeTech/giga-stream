import { createElement } from "react";
import type { RecordRowView } from "@giga/ui/lists/record-table-types";
import { TitleAddButton } from "@/components/titles/TitleAddButton";
import { browseStateOf, openReason } from "@/lib/title-browse";
import type { AdminTitleRow } from "@/services/schemas/title-schema";
import { useAppStore } from "@/store/app-store";
import type { TitleAdd } from "./useTitleAdd";

/** What a Browse TMDB row says about itself (`docs/47` section 4): the `stored` / `deleted` word and the dimming that
 *  goes with it, its tick, the end `Add`, and its press. A press opens the workspace only for a stored title; any other
 *  row has no stored detail (a read of it is `404`), so no call is made and the notice line says why. */
export function useTitleBrowseRowView(
  add: TitleAdd,
  unreachable: boolean,
): (title: AdminTitleRow, ticked: boolean, onTick: (on: boolean) => void) => RecordRowView {
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const say = useAppStore((state) => state.say);
  return (title, ticked, onTick) => {
    const state = browseStateOf(title);
    return {
      ...(state !== null && { state: state.word }),
      dimmed: state?.dimmed === true,
      ticked,
      tick: { label: `Select ${title.title}`, onToggle: onTick },
      onOpen: () => {
        const reason = openReason(title);
        if (reason === undefined) openWorkspace("titles", title.id);
        else say(`${title.title}: ${reason}`, "info", "Title");
      },
      end: createElement(TitleAddButton, {
        title,
        busy: add.busy,
        unreachable,
        onAdd: () => add.addRow(title.id, title.title),
      }),
    };
  };
}
