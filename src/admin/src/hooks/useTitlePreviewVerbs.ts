import { useState } from "react";
import { LOADING_REASON, SAVING_REASON, TITLE_GONE, UNREACHABLE_REASON } from "@/constants/title-copy";
import type { ToggleVerb } from "@/lib/preview-verbs";
import { draftOfTitle } from "@/lib/title-draft";
import type { AdminTitleDetail } from "@/services/schemas/title-schema";
import { useTitleFlows } from "./useTitleFlows";

export interface TitlePreviewVerbs {
  /** The toolbar's `Enabled` switch plan. */
  readonly enabled: ToggleVerb;
  readonly toggleEnabled: () => void;
}

/** The title preview's `Enabled` switch (`55` decision 8, the channels' own labelled pattern): the title's own `enabled`
 *  through the Titles flows' ONE save - a `PATCH` of the single changed field. One verb runs at a time; the answer
 *  replaces the row, the open detail and the window together. */
export function useTitlePreviewVerbs(
  detail: AdminTitleDetail | undefined,
  gone: boolean,
  unreachable: boolean,
): TitlePreviewVerbs {
  const flows = useTitleFlows();
  const [busy, setBusy] = useState(false);

  const toggle = (): void => {
    if (detail === undefined || busy) return;
    setBusy(true);
    void flows
      .save(detail.id, { ...draftOfTitle(detail), enabled: !(detail.enabled ?? true) })
      .finally(() => setBusy(false));
  };

  return {
    enabled: {
      checked: detail?.enabled !== false,
      reason: detail === undefined
        ? gone
          ? TITLE_GONE
          : LOADING_REASON
        : unreachable
          ? UNREACHABLE_REASON
          : busy
            ? SAVING_REASON
            : undefined,
    },
    toggleEnabled: toggle,
  };
}