import { Workspace } from "@giga/ui/form/Workspace";
import { NEW_CHANNEL_LABELS } from "@/constants/channel-copy";
import { useChannelBulk } from "@/hooks/useChannelBulk";
import { ChannelsList } from "./ChannelsList";
import { NewChannelForm } from "./NewChannelForm";

/** The Channels index (`36` section 5): `New channel` and the list, whose table strip holds the `Preview channel` icon
 *  and the bulk verbs. A bulk run holds the New form's `Create` too. No page toolbar sits above them. */
export function ChannelsIndex() {
  const bulk = useChannelBulk();
  return (
    <Workspace labels={NEW_CHANNEL_LABELS}>
      <NewChannelForm working={bulk.working} />
      <ChannelsList bulk={bulk} />
    </Workspace>
  );
}
