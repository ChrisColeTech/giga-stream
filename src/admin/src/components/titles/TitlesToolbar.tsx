import { ToolbarStrip, type ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { useTitleBulk } from "@/hooks/useTitleBulk";
import { indexVerbs } from "@/lib/index-verbs";
import { useAppStore } from "@/store/app-store";

/** The Titles index toolbar (owner, 2026-10-17; `37` section 4.2): the ghost bulk verbs Enable, Disable, Revert to TMDB
 *  and an armed Delete over the ticked rows, each disabled with its reason (`Tick a row first`, the first skipped row's
 *  reason when nothing is left to run), beside the filled forward verb `Jobs →`. */
export function TitlesToolbar() {
  const { verbs, notes, dismiss } = useTitleBulk();
  const requestTab = useAppStore((state) => state.requestTab);
  const strip: ToolbarVerb[] = [
    ...verbs.map((verb) => ({
      id: verb.verb,
      label: verb.label,
      tone: "ghost" as const,
      reason: verb.reason,
      onPress: verb.press,
      ...(verb.question !== undefined && { question: verb.question }),
    })),
    ...indexVerbs(INDEX_FRAMES.titles.forward, (tab) => requestTab(tab)),
  ];

  return (
    <>
      <ToolbarStrip label="Titles toolbar" verbs={strip} />
      <BulkNotes notes={notes} onDismiss={dismiss} />
    </>
  );
}
