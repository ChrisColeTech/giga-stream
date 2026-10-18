import { ToolbarStrip, type ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { useProviderBulk } from "@/hooks/useProviderBulk";
import { indexVerbs } from "@/lib/index-verbs";
import { useAppStore } from "@/store/app-store";

/** The Providers index toolbar (owner, 2026-10-17; `37` section 3.2): the ghost bulk verbs Enable, Disable and an armed
 *  Delete over the ticked rows, each disabled with its reason (`Tick a row first`, every ticked row already in that
 *  state, the backend unreachable), beside the filled forward verb `Titles →`. What a run could not do is listed under the
 *  strip. */
export function ProvidersToolbar() {
  const { verbs, notes, dismiss } = useProviderBulk();
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
    ...indexVerbs(INDEX_FRAMES.providers.forward, (tab) => requestTab(tab)),
  ];

  return (
    <>
      <ToolbarStrip label="Providers toolbar" verbs={strip} />
      <BulkNotes notes={notes} onDismiss={dismiss} />
    </>
  );
}
