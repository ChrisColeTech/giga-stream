import { Activity } from "lucide-react";
import { Group } from "@giga/ui/form/Group";
import { Row } from "@giga/ui/form/Row";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import {
  CHANNELS_TIP, FILE_NAME_TIP, HOST_TIP, LAST_RUN_TIP, RESULT_TIP, SOURCE_FILE, SOURCE_TYPE_TIP, SOURCE_URL,
} from "@/constants/playlist-copy";
import { formatWhen } from "@/lib/format-when";
import { countsText } from "@/lib/playlist-counts";
import { runWords } from "@/lib/run-words";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

const FACT = "flex h-9 min-w-0 items-center font-mono text-sm text-muted";

/** A fact not there (yet): a shimmer line in the fact's place, never a sentence. */
function Shimmer({ width = "40%" }: { readonly width?: string }) {
  return (
    <span className="flex h-9 w-full items-center" aria-hidden>
      <span className={SHIMMER} style={{ width }} />
    </span>
  );
}

/** `Status` (`38` section 3.3, `43` section 4.1), read-only: the Host (a file playlist, its File), the Source type (`File`
 *  or `Web address`), the Channels counts line (`2,598 channels · 0 enabled · 1,904 live · 640 dead`), the Last run time
 *  and the run in words, built here from the job's typed result. No sync verb and no channel list here: syncing is a Jobs
 *  matter, and the toolbar's `Channels →` opens this playlist's channels. */
export function PlaylistStatusGroup({ playlist }: { readonly playlist: AdminPlaylist }) {
  const words = runWords(playlist.lastResult, playlist.lastCounts);
  const file = playlist.kind === "file";
  return (
    <Group id="pw-status" icon={Activity} title="Status" last>
      {file ? (
        <Row label="File" tip={FILE_NAME_TIP}>
          <span className={FACT}>{playlist.fileName ?? playlist.name}</span>
        </Row>
      ) : (
        <Row label="Host" tip={HOST_TIP}>
          <span className={FACT}>{playlist.host ?? ""}</span>
        </Row>
      )}
      <Row label="Source type" tip={SOURCE_TYPE_TIP}>
        <span className={FACT}>{file ? SOURCE_FILE : SOURCE_URL}</span>
      </Row>
      <Row label="Channels" tip={CHANNELS_TIP}>
        <span className={FACT}>{countsText(playlist)}</span>
      </Row>
      <Row label="Last run" tip={LAST_RUN_TIP}>
        <span className={FACT}>{formatWhen(playlist.lastRunAt)}</span>
      </Row>
      <Row label="Result" tip={RESULT_TIP}>
        {words === undefined ? (
          <Shimmer />
        ) : (
          <span className="flex min-h-9 items-center py-2 text-sm text-muted">{words}</span>
        )}
      </Row>
    </Group>
  );
}
