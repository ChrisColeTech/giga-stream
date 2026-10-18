import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { LOADING_REASON } from "@/constants/account-copy";
import { ADD_PLAYLIST_FIRST, DISABLED_MARK, PLAYLISTS_UNREAD } from "@/constants/job-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";

export interface JobPlaylistSelectProps {
  readonly playlists: readonly AdminPlaylist[];
  /** The chosen playlist's id as text; `""` when there is none to choose. */
  readonly value: string;
  readonly onChange: (playlistId: string) => void;
  readonly invalid?: boolean;
}

/** The Playlist row's control: ALWAYS the real select. With playlists it lists them (a disabled playlist is listed
 *  but marked: its job refuses to run, with the backend's reason). With none it is natively disabled with no options,
 *  and its reason rides the focusable tooltip: `Loading.` while the read runs, `The playlists could not be read.` when
 *  it failed, `Add a playlist first.` when it answered with none. No sentence is drawn in the row. */
export function JobPlaylistSelect({ playlists, value, onChange, invalid = false }: JobPlaylistSelectProps) {
  const status = useAppStore((state) => state.jobs.playlistsStatus);
  const none = playlists.length === 0;
  const reason = !none
    ? undefined
    : status === "idle" || status === "loading"
      ? LOADING_REASON
      : status === "failed"
        ? PLAYLISTS_UNREAD
        : ADD_PLAYLIST_FIRST;
  const select = (
    <Select
      value={value}
      className={FIELD_CONTROL}
      aria-label="Playlist"
      aria-invalid={invalid}
      disabled={reason !== undefined}
      onChange={(event) => onChange(event.target.value)}
    >
      {playlists.map((playlist) => (
        <option key={playlist.id} value={String(playlist.id)}>
          {playlist.enabled ? playlist.name : `${playlist.name} · ${DISABLED_MARK}`}
        </option>
      ))}
    </Select>
  );
  return reason === undefined ? (
    select
  ) : (
    <Tooltip text={reason} focusable label={`Playlist. ${reason}`} className="w-full">
      {select}
    </Tooltip>
  );
}
