import { InlineLink } from "@giga/ui/controls/InlineLink";
import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { ADD_A_PLAYLIST, DISABLED_MARK, NO_PLAYLISTS, PLAYLISTS_UNREAD } from "@/constants/job-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";

export interface JobPlaylistSelectProps {
  readonly playlists: readonly AdminPlaylist[];
  /** The chosen playlist's id as text; `""` when there is none to choose. */
  readonly value: string;
  readonly onChange: (playlistId: string) => void;
  readonly invalid?: boolean;
}

/** The Playlist row's control, in three states by the playlists read: still loading, a shimmer line; failed, the
 *  failure sentence; answered with none, `No playlists yet.` and a link to the Playlists tab; otherwise a select of the
 *  playlist records. A disabled playlist is listed but marked (its job refuses to run, with the backend's reason). */
export function JobPlaylistSelect({ playlists, value, onChange, invalid = false }: JobPlaylistSelectProps) {
  const status = useAppStore((state) => state.jobs.playlistsStatus);
  const requestTab = useAppStore((state) => state.requestTab);
  if (playlists.length === 0) {
    if (status === "idle" || status === "loading") {
      return (
        <span className="flex h-9 w-full items-center" aria-hidden>
          <span className={SHIMMER} style={{ width: "44%" }} />
        </span>
      );
    }
    return (
      <span className="flex h-9 w-full items-center gap-1.5 text-sm text-muted">
        {status === "failed" ? (
          PLAYLISTS_UNREAD
        ) : (
          <>
            {NO_PLAYLISTS}
            <InlineLink onClick={() => requestTab("playlists")}>{ADD_A_PLAYLIST}</InlineLink>
          </>
        )}
      </span>
    );
  }
  return (
    <Select
      value={value}
      className={FIELD_CONTROL}
      aria-label="Playlist"
      aria-invalid={invalid}
      onChange={(event) => onChange(event.target.value)}
    >
      {playlists.map((playlist) => (
        <option key={playlist.id} value={String(playlist.id)}>
          {playlist.enabled ? playlist.name : `${playlist.name} · ${DISABLED_MARK}`}
        </option>
      ))}
    </Select>
  );
}
