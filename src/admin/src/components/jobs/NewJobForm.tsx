import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { NAME_TIP } from "@/constants/job-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { createReason } from "@/lib/job-checks";
import { EMPTY_NEW_JOB, sameNewJob } from "@/lib/job-draft";
import { useAppStore } from "@/store/app-store";
import { CatalogRows } from "./CatalogRows";

/** `New job` (`38` section 4.2, `43` section 4.1): catalog jobs only - a playlist's job is made with the playlist, so
 *  there is no Type and no Playlist. Name first, then Scope and Kind. `Create` is disabled with `Name is required.`,
 *  `Saving.` or the unreachable sentence. A catalog job's pages are left to the backend's default. On success the form
 *  empties. */
export function NewJobForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_JOB, same: sameNewJob });
  const { flows, saving, track } = useJobActions();
  const unreachable = useAppStore((state) => state.jobs.unreachable);
  const reason = createReason(form.draft, saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_JOB);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  return (
    <NewRecordGroup id="jb-create" icon={Plus} title="New job" create={{ onPress: () => void create(), reason }}>
      <Row label="Name" tip={NAME_TIP} error={form.errors["name"]}>
        <Input
          type="text"
          value={form.draft.name}
          className={FIELD_CONTROL}
          aria-label="Name"
          aria-invalid={form.errors["name"] !== undefined}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => form.set({ name: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") void create();
          }}
        />
      </Row>
      <CatalogRows scope={form.draft.scope} kind={form.draft.kind} onChange={form.set} />
    </NewRecordGroup>
  );
}
