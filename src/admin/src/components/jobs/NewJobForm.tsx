import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { PLAYLIST_TIP, TYPE_TIP } from "@/constants/job-copy";
import { useJobActions } from "@/hooks/useJobActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { createReason } from "@/lib/job-checks";
import { EMPTY_NEW_JOB, chosenPlaylist, sameNewJob, type JobType } from "@/lib/job-draft";
import { useAppStore } from "@/store/app-store";
import { CatalogRows } from "./CatalogRows";
import { JobPlaylistSelect } from "./JobPlaylistSelect";

const TYPES = [
  { value: "playlist", label: "Playlist" },
  { value: "catalog", label: "Catalog" },
] as const satisfies ReadonlyArray<{ value: JobType; label: string }>;

/** `New job` (`38` section 4.2): Name first, then Type (Playlist / Catalog, the row switcher), then the type's own
 *  rows: Playlist (a select of the playlist records) for a playlist job, or Scope and Kind for a catalog job. The rows
 *  a Type does not use are not rendered and leave the required list. `Create` is disabled with `Name is required.`, then
 *  `Add a playlist first.` (none exist; `Playlist is required.` when the read has not answered), `Saving.` or the
 *  unreachable sentence. A catalog job's pages are
 *  left to the backend's default. On success the form empties. */
export function NewJobForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_JOB, same: sameNewJob });
  const { flows, saving, track } = useJobActions();
  const unreachable = useAppStore((state) => state.jobs.unreachable);
  const playlists = useAppStore((state) => state.jobs.playlists);
  const playlistId = chosenPlaylist(form.draft.playlistId, playlists);
  const busy = saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined;
  const none = useAppStore((state) => state.jobs.playlistsStatus === "ready" && state.jobs.playlists.length === 0);
  const reason = createReason(form.draft, playlistId, busy, none);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft, playlistId));
    if (result.ok) form.reset(EMPTY_NEW_JOB);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  return (
    <NewRecordGroup id="jb-create" icon={Plus} title="New job" create={{ onPress: () => void create(), reason }}>
      <Row label="Name" error={form.errors["name"]}>
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
      <Row label="Type" tip={TYPE_TIP}>
        <Segmented
          field
          options={TYPES}
          value={form.draft.type}
          aria-label="Type"
          onChange={(type) => form.set({ type })}
        />
      </Row>
      {form.draft.type === "playlist" ? (
        <Row label="Playlist" tip={PLAYLIST_TIP} error={form.errors["playlistId"]}>
          <JobPlaylistSelect
            playlists={playlists}
            value={playlistId}
            invalid={form.errors["playlistId"] !== undefined}
            onChange={(next) => form.set({ playlistId: next })}
          />
        </Row>
      ) : (
        <CatalogRows scope={form.draft.scope} kind={form.draft.kind} onChange={form.set} />
      )}
    </NewRecordGroup>
  );
}
