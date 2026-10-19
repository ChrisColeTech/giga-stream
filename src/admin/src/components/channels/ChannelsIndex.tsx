import { Workspace } from "@giga/ui/form/Workspace";
import { IndexToolbar } from "@/components/records/IndexToolbar";
import { NEW_CHANNEL_LABELS } from "@/constants/channel-copy";
import { useChannelBulk } from "@/hooks/useChannelBulk";
import { useIndexPreviewPromote } from "@/hooks/useIndexPreviewPromote";
import { ChannelsList } from "./ChannelsList";
import { NewChannelForm } from "./NewChannelForm";

/** The Channels index (`36` section 5): the page toolbar with `Preview` on the right (one ticked row), then the
 *  scrolling column, `New channel` and the list, whose first row holds the bulk verbs. A bulk run holds the New form's
 *  `Create` too. */
export function ChannelsIndex() {
  const bulk = useChannelBulk();
  const promote = useIndexPreviewPromote("channels");
  return (
    <>
      <IndexToolbar promote={promote} />
      <Workspace labels={NEW_CHANNEL_LABELS} fill>
        <NewChannelForm working={bulk.working} />
        <ChannelsList bulk={bulk} />
      </Workspace>
    </>
  );
}
