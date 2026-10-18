import { Plus } from "lucide-react";
import { Input } from "@giga/ui/controls/Input";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Row } from "@giga/ui/form/Row";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import { NAME_TIP, NEW_ADDRESS_TIP } from "@/constants/playlist-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { EMPTY_NEW_PLAYLIST, createReason, sameNewPlaylist } from "@/lib/playlist-draft";
import { useAppStore } from "@/store/app-store";

/** `New playlist` (`38` section 3.2): Name first (optional: left empty, the backend names the playlist after its host),
 *  then Address, a password field that is never filled back, autocomplete and spellcheck off. `Create` is disabled with
 *  `Address is required.`, `Saving.` while a call runs, or the unreachable sentence; the Name never gates it. Pressing
 *  it (or Enter) checks the address first; a refusal shows under its row. On success the form empties, address too. */
export function NewPlaylistForm() {
  const form = useRecordForm({ initial: EMPTY_NEW_PLAYLIST, same: sameNewPlaylist });
  const { flows, saving, track } = usePlaylistActions();
  const unreachable = useAppStore((state) => state.playlists.unreachable);
  const reason = createReason(form.draft, saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined);

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_PLAYLIST);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };
  const enter = (key: string): void => {
    if (key === "Enter") void create();
  };

  return (
    <NewRecordGroup id="pl-create" icon={Plus} title="New playlist" create={{ onPress: () => void create(), reason }}>
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
          onKeyDown={(event) => enter(event.key)}
        />
      </Row>
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
          onKeyDown={(event) => enter(event.key)}
        />
      </Row>
    </NewRecordGroup>
  );
}
