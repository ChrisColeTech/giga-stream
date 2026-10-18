import { UserPlus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { useAccountActions } from "@/hooks/useAccountActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { EMPTY_NEW_ACCOUNT, sameNewAccount, type NewAccountDraft } from "@/lib/account-draft";
import { createReason } from "@/lib/account-checks";
import { useAppStore } from "@/store/app-store";

/* The rows, in the owner's order (Name first on every form) and no others: no role (`26` D22), no info glyph, no
 * placeholder. */
const FIELDS = [
  { key: "name", label: "Name", type: "text", autoComplete: "off" },
  { key: "username", label: "Username", type: "text", autoComplete: "off" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
] as const satisfies ReadonlyArray<{ key: keyof NewAccountDraft; label: string; type: string; autoComplete: string }>;

/** `New account`: Name, Username, Password and one `Create`, disabled with the first missing field's reason (`Name is
 *  required.`, then Username, then Password), `Saving.` while a call runs, or the unreachable sentence. Pressing it (or Enter
 *  in a field) checks the values first; a refusal, the page's or the backend's, shows under its row with `aria-invalid`.
 *  On success the form empties; on failure it keeps every value. */
export function NewAccountForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_ACCOUNT, same: sameNewAccount });
  const { flows, saving, track } = useAccountActions();
  const unreachable = useAppStore((state) => state.accounts.unreachable);
  const reason = createReason(form.draft, saving, unreachable);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_ACCOUNT);
    else if (result.dropped !== true && result.field !== undefined && result.field !== "enabled") {
      form.setError(result.field, result.sentence);
    }
  };

  return (
    <NewRecordGroup
      id="accounts-create"
      icon={UserPlus}
      title="New account"
      create={{ onPress: () => void create(), reason }}
    >
      {FIELDS.map((field) => (
        <Row key={field.key} label={field.label} error={form.errors[field.key]}>
          <Input
            type={field.type}
            value={form.draft[field.key]}
            className={FIELD_CONTROL}
            aria-label={field.label}
            aria-invalid={form.errors[field.key] !== undefined}
            autoComplete={field.autoComplete}
            spellCheck={false}
            onChange={(event) => form.set({ [field.key]: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
            }}
          />
        </Row>
      ))}
    </NewRecordGroup>
  );
}
