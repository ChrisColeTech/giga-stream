import { ToolbarStrip, type ToolbarVerb } from "@giga/ui/shell/ToolbarStrip";
import { BulkNotes } from "@/components/records/BulkNotes";
import { useAccountBulk } from "@/hooks/useAccountBulk";

/** The Accounts toolbar (owner, 2026-10-17): Enable, Disable and an armed Delete for the ticked accounts, each disabled
 *  with its reason (`Tick an account first`, the signed-in or last enabled account, the backend unreachable). What a run
 *  could not do is listed under the strip. */
export function AccountsToolbar() {
  const { verbs, notes, dismiss } = useAccountBulk();
  const strip: ToolbarVerb[] = verbs.map((verb) => ({
    id: verb.verb,
    label: verb.label,
    tone: verb.verb === "delete" ? "ghost" : "edged",
    reason: verb.reason,
    onPress: verb.press,
    ...(verb.question !== undefined && { question: verb.question }),
  }));

  return (
    <>
      <ToolbarStrip label="Accounts toolbar" verbs={strip} />
      <BulkNotes notes={notes} onDismiss={dismiss} />
    </>
  );
}
