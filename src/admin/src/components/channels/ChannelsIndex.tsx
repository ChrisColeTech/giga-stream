import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_CHANNEL_LABELS } from "@/constants/channel-copy";
import { useChannelBulk } from "@/hooks/useChannelBulk";
import { ChannelsList } from "./ChannelsList";
import { ChannelsToolbar } from "./ChannelsToolbar";
import { NewChannelForm } from "./NewChannelForm";

/** The Channels index (`36` section 5): the page toolbar (the `Preview` arrow) over `New channel` and the list, whose table
 *  strip holds the bulk verbs. A bulk run holds the New form's `Create` too. */
export function ChannelsIndex() {
  const bulk = useChannelBulk();
  return (
    <>
      <ChannelsToolbar />
      <Workspace labels={NEW_CHANNEL_LABELS}>
        <NewChannelForm working={bulk.working} />
        <ChannelsList bulk={bulk} />
      </Workspace>
    </>
  );
}
