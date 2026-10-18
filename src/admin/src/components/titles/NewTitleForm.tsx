import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { KIND_NEW_TIP, KIND_OPTIONS, TITLE_TIP, YEAR_TIP } from "@/constants/title-copy";
import { useRecordForm } from "@/hooks/useRecordForm";
import { useTitleActions } from "@/hooks/useTitleActions";
import { createReason } from "@/lib/title-checks";
import { EMPTY_NEW_TITLE, sameNewTitle } from "@/lib/title-draft";
import { useAppStore } from "@/store/app-store";

/** `New title` (`37` section 4.2): Title (the record's name, so first), Kind (Movie or Series, an ordinary row 2 that
 *  switches nothing) and Year, then one `Create` that posts a manual title, disabled with the first missing field's
 *  reason, `Saving.` or the unreachable sentence. A manual title is stored by the backend itself, so it can be created
 *  with no TMDB token. A refusal shows under its row; on success the form empties. */
export function NewTitleForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_TITLE, same: sameNewTitle });
  const { flows, saving, track } = useTitleActions();
  const unreachable = useAppStore((state) => state.titles.unreachable);
  const reason = createReason(form.draft, saving, unreachable);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_TITLE);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };
  const enter = (event: { readonly key: string }): void => {
    if (event.key === "Enter") void create();
  };

  return (
    <NewRecordGroup id="nt-create" icon={Plus} title="New title" create={{ onPress: () => void create(), reason }}>
      <Row label="Title" tip={TITLE_TIP} error={form.errors["title"]}>
        <Input
          value={form.draft.title}
          className={FIELD_CONTROL}
          aria-label="Title"
          aria-invalid={form.errors["title"] !== undefined}
          autoComplete="off"
          onChange={(event) => form.set({ title: event.target.value })}
          onKeyDown={enter}
        />
      </Row>
      <Row label="Kind" tip={KIND_NEW_TIP}>
        <Segmented
          aria-label="Kind"
          options={KIND_OPTIONS}
          value={form.draft.kind}
          onChange={(kind) => form.set({ kind })}
        />
      </Row>
      <Row label="Year" tip={YEAR_TIP} error={form.errors["year"]}>
        <Input
          inputMode="numeric"
          value={form.draft.year}
          className={FIELD_CONTROL}
          aria-label="Year"
          aria-invalid={form.errors["year"] !== undefined}
          autoComplete="off"
          onChange={(event) => form.set({ year: event.target.value })}
          onKeyDown={enter}
        />
      </Row>
    </NewRecordGroup>
  );
}
