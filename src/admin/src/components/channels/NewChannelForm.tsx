import { Plus } from "lucide-react";
import { NewRecordGroup } from "@/components/records/NewRecordGroup";
import { CHOOSE_UNAVAILABLE } from "@/constants/channel-copy";
import { useChannelActions } from "@/hooks/useChannelActions";
import { useRecordForm } from "@/hooks/useRecordForm";
import { EMPTY_NEW_CHANNEL, sameNewChannel, withKind } from "@/lib/channel-body";
import { createReason } from "@/lib/channel-check";
import { useAppStore } from "@/store/app-store";
import { NewChannelRows } from "./NewChannelRows";

/** `New channel` (`36` section 5.1): the rows and one `Create`, disabled with the first empty row's reason, `Saving.` while
 *  a call runs, `Working.` while a bulk run goes, or the unreachable sentence. Pressing it (or Enter in a field) checks the
 *  values first; a refusal, the page's or the backend's, shows under its row with `aria-invalid`. The body carries no
 *  id: the backend assigns it. On success the form empties; on failure it keeps every value. */
export function NewChannelForm({ working }: { readonly working: boolean }) {
  const form = useRecordForm({ initial: EMPTY_NEW_CHANNEL, same: sameNewChannel });
  const { flows, saving, track, canChoose, chooseFolder } = useChannelActions();
  const unreachable = useAppStore((state) => state.channels.unreachable);
  const reason = createReason(form.draft, { saving, unreachable, working });

  const create = async (): Promise<void> => {
    if (reason !== undefined) return;
    form.clearErrors();
    const result = await track("create", () => flows.create(form.draft));
    if (result.ok) form.reset(EMPTY_NEW_CHANNEL);
    else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  const choose = async (): Promise<void> => {
    const folder = await chooseFolder();
    if (folder !== null) form.set({ folder });
  };

  return (
    <NewRecordGroup id="ch-create" icon={Plus} title="New channel" create={{ onPress: () => void create(), reason }}>
      <NewChannelRows
        draft={form.draft}
        errors={form.errors}
        onChange={form.set}
        onKind={(kind) => form.set(withKind(form.draft, kind))}
        onEnter={() => void create()}
        chooseReason={canChoose ? undefined : CHOOSE_UNAVAILABLE}
        onChoose={() => void choose()}
      />
    </NewRecordGroup>
  );
}
