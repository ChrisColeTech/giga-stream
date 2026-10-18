import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { FAMILY_OPTIONS, FAMILY_TIP, MOVIE_TEMPLATE_TIP, SOURCE_TIP } from "@/constants/provider-copy";
import { useProviderActions } from "@/hooks/useProviderActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { createReason } from "@/lib/provider-checks";
import { EMPTY_NEW_PROVIDER, sameNewProvider, showsTemplates } from "@/lib/provider-draft";
import { useAppStore } from "@/store/app-store";

type TextKey = "name" | "source" | "movieTemplate";

/** `New provider` (`37` section 3.2): Name, Family (Embed or Stream, a row switcher: an embed provider shows the Movie
 *  template row, a stream provider does not), Source, Movie template, and one `Create`, disabled with the first missing
 *  field's reason, `Saving.` or the unreachable sentence. A refusal, the page's or the backend's `422`, shows under its
 *  row with `aria-invalid`. On success the form empties; on failure it keeps every value. */
export function NewProviderForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_PROVIDER, same: sameNewProvider });
  const { flows, saving, track } = useProviderActions();
  const unreachable = useAppStore((state) => state.providers.unreachable);
  const reason = createReason(form.draft, saving, unreachable);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_PROVIDER);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  const text = (key: TextKey, label: string, tip?: string) => (
    <Row label={label} tip={tip} error={form.errors[key]}>
      <Input
        value={form.draft[key]}
        className={FIELD_CONTROL}
        aria-label={label}
        aria-invalid={form.errors[key] !== undefined}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => form.set({ [key]: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter") void create();
        }}
      />
    </Row>
  );

  return (
    <NewRecordGroup id="pv-create" icon={Plus} title="New provider" create={{ onPress: () => void create(), reason }}>
      {text("name", "Name")}
      <Row label="Family" tip={FAMILY_TIP}>
        <Segmented
          field
          aria-label="Family"
          options={FAMILY_OPTIONS}
          value={form.draft.family}
          onChange={(family) => form.set({ family })}
        />
      </Row>
      {text("source", "Source", SOURCE_TIP)}
      {showsTemplates(form.draft.family) && text("movieTemplate", "Movie template", MOVIE_TEMPLATE_TIP)}
    </NewRecordGroup>
  );
}
