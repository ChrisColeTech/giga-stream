import { ApiError } from "@giga/http/api-error";
import { REQUEST_FAILED } from "@/constants/channel-copy";
import { FAILURE_CODES } from "@/constants/api-sentences";
import type { ChannelBulkVerb } from "@/lib/channel-bulk";
import type { BulkItem } from "@/lib/bulk-plan";
import type { ChannelStore } from "./channel-flow-support";
import type { ChannelsService } from "./channels";

/** The one single-record call a bulk verb makes for each row (`36` section 5.3): `PATCH { enabled }` for Enable and
 *  Disable, `POST .../rebuild`, `DELETE`, straight to the service (no per-row notice: the runner says one summary). A
 *  success updates the held list; a failure answers its sentence and the run goes on. */
export function createChannelBulkCall(deps: {
  readonly service: Pick<ChannelsService, "update" | "rebuild" | "remove">;
  readonly store: () => Pick<ChannelStore, "channelUpsert" | "channelRemove" | "channelsMarkUnreachable">;
}): (verb: ChannelBulkVerb) => (item: BulkItem<string>) => Promise<string | null> {
  const { service, store } = deps;
  return (verb) => async (item) => {
    try {
      if (verb === "delete") {
        await service.remove(item.id);
        store().channelRemove(item.id);
      } else if (verb === "rebuild") {
        store().channelUpsert(await service.rebuild(item.id));
      } else {
        store().channelUpsert(await service.update(item.id, { enabled: verb === "enable" }));
      }
      return null;
    } catch (error: unknown) {
      if (!(error instanceof ApiError)) return REQUEST_FAILED;
      if (error.code === FAILURE_CODES.unreachable) store().channelsMarkUnreachable(true);
      return error.message;
    }
  };
}
