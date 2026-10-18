import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

/** Says the Preview's failure sentence once on the notice line (and the Events drawer), as the state word changes to a
 *  failed one. The window itself keeps only the word; a sentence over the stage is not part of the grammar. */
export function usePreviewNotice(notice: string | undefined): void {
  const say = useAppStore((state) => state.say);
  useEffect(() => {
    if (notice !== undefined) say(notice, "warn", "Channel");
  }, [notice, say]);
}
