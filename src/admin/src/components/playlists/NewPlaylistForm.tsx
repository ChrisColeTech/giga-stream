import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { Segmented } from "@giga/ui/controls/Segmented";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { FileRow } from "@/components/records/FileRow";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { UNREACHABLE_REASON } from "@/constants/account-copy";
import {
  CHOOSE_FILE_TITLE, FILE_TIP, IMPORTING_REASON, IMPORT_FILE_ACCEPT, NEW_ADDRESS_TIP, SOURCE_FILE, SOURCE_TIP, SOURCE_URL,
} from "@/constants/playlist-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { EMPTY_NEW_PLAYLIST, createReason, sameNewPlaylist, type ImportSource } from "@/lib/playlist-draft";
import { useAppStore } from "@/store/app-store";

const SOURCES = [
  { value: "file", label: SOURCE_FILE },
  { value: "url", label: SOURCE_URL },
] as const satisfies ReadonlyArray<{ value: ImportSource; label: string }>;

/** `New playlist` (`43` section 4.1): `Source` (File | Web address), then the chosen source's own row: `File`, a read-only
 *  field with the chosen file's name and a ghost `Choose file`, or `Address`, a password field that is never filled back,
 *  autocomplete and spellcheck off. There is no Name: the playlist is named after its file or its host, and renamed in
 *  its workspace. The one primary `Import` is disabled with `Choose a file first.`, `Address is required.`, `Importing.`
 *  while a call runs, or the unreachable sentence. A refusal shows under its row. On success the form empties. */
export function NewPlaylistForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_PLAYLIST, same: sameNewPlaylist });
  const { flows, saving, track } = usePlaylistActions();
  const unreachable = useAppStore((state) => state.playlists.unreachable);
  const reason = createReason(form.draft, saving ? IMPORTING_REASON : unreachable ? UNREACHABLE_REASON : undefined);

  const run = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.importPlaylist(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_PLAYLIST);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  return (
    <NewRecordGroup
      id="pl-create"
      icon={Plus}
      title="New playlist"
      create={{ onPress: () => void run(), reason, label: "Import" }}
    >
      <Row label="Source" tip={SOURCE_TIP}>
        <Segmented
          options={SOURCES}
          value={form.draft.source}
          aria-label="Source"
          onChange={(source) => form.set({ source })}
        />
      </Row>
      {form.draft.source === "file" ? (
        <FileRow
          tip={FILE_TIP}
          value={form.draft.file?.name ?? ""}
          accept={IMPORT_FILE_ACCEPT}
          chooseTitle={CHOOSE_FILE_TITLE}
          error={form.errors["file"]}
          onChoose={(file) => form.set({ file })}
        />
      ) : (
        <Row label="Address" tip={NEW_ADDRESS_TIP} error={form.errors["address"]}>
          <Input
            type="password"
            value={form.draft.address}
            className={FIELD_CONTROL}
            aria-label="Address"
            aria-invalid={form.errors["address"] !== undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => form.set({ address: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
          />
        </Row>
      )}
    </NewRecordGroup>
  );
}
