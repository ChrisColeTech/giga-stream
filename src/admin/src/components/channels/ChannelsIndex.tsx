import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_CHANNEL_LABELS } from "@/constants/channel-copy";
import { useChannelBulk } from "@/hooks/useChannelBulk";
import { ChannelsList } from "./ChannelsList";
import { ChannelsToolbar } from "./ChannelsToolbar";
import { NewChannelForm } from "./NewChannelForm";

/** The Channels index (`36` section 5): the toolbar strip (the bulk verbs and `Preview →`) over `New channel` and the
 *  list. A bulk run holds the New form's `Create` too. */
export function ChannelsIndex() {
  const bulk = useChannelBulk();
  return (
    <>
      <ChannelsToolbar bulk={bulk} />
      <Workspace labels={NEW_CHANNEL_LABELS}>
        <NewChannelForm working={bulk.working} />
        <ChannelsList />
      </Workspace>
    </>
  );
}
