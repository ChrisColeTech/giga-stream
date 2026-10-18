import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import { InlineLink } from "@giga/ui/controls/InlineLink";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { CHANNELS_TIP, HOST_TIP, LAST_SYNCED_TIP, OUTCOME_TIP } from "@/constants/playlist-copy";
import type { PlaylistChannels } from "@/hooks/usePlaylistChannels";
import { formatWhen } from "@/lib/format-when";
import { openPlaylistChannel } from "@/lib/open-playlist-channel";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";

const FACT = "flex h-9 min-w-0 items-center font-mono text-sm text-muted";

/** A fact not there (yet): a shimmer line in the fact's place, never a sentence. */
function Shimmer({ width = "40%" }: { readonly width?: string }) {
  return (
    <span className="flex h-9 w-full items-center" aria-hidden>
      <span className={SHIMMER} style={{ width }} />
    </span>
  );
}

export interface PlaylistStatusGroupProps {
  readonly playlist: AdminPlaylist;
  /** The channels read for its host (`usePlaylistChannels`). */
  readonly channels: PlaylistChannels;
}

/** `Status` (`38` section 3.3), read-only: Host, the Channels synced from it (each a link that opens the channel on the
 *  Channels tab), Last synced (local time or `never`), Outcome. No sync verb here: syncing is a Jobs matter. The
 *  channels are read through the channels service; until it answers, or when it refuses, shimmer lines stand in their place. */
export function PlaylistStatusGroup({ playlist, channels }: PlaylistStatusGroupProps) {
  const requestTab = useAppStore((state) => state.requestTab);
  const channelRemember = useAppStore((state) => state.channelRemember);
  const store = { requestTab, channelRemember };
  let list: ReactNode = (
    <span className="flex w-full flex-col">
      <Shimmer width="46%" />
      <Shimmer width="32%" />
    </span>
  );
  if (channels.status === "ready" && channels.items.length > 0) {
    list = (
      <ul className="m-0 flex list-none flex-col gap-1 p-0 py-2" aria-label="Channels from this playlist">
        {channels.items.map((channel) => (
          <li key={channel.id}>
            <InlineLink onClick={() => openPlaylistChannel(channel, store)}>{channel.name}</InlineLink>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Group id="pw-status" icon={Activity} title="Status" last>
      <Row label="Host" tip={HOST_TIP}>
        <span className={FACT}>{playlist.host}</span>
      </Row>
      <Row label="Channels" tip={CHANNELS_TIP} align="start">
        {list}
      </Row>
      <Row label="Last synced" tip={LAST_SYNCED_TIP}>
        <span className={FACT}>{formatWhen(playlist.lastSyncedAt)}</span>
      </Row>
      <Row label="Outcome" tip={OUTCOME_TIP}>
        {playlist.lastOutcome === undefined ? (
          <Shimmer />
        ) : (
          <span className="flex min-h-9 items-center py-2 text-sm text-muted">{playlist.lastOutcome}</span>
        )}
      </Row>
    </Group>
  );
}
