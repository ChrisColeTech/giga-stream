import { Select } from "@giga/ui/controls/Select";
import { FIELD_CONTROL } from "@giga/ui/form/form-classes";
import { SHIMMER } from "@giga/ui/lib/shimmer";
import { DISABLED_MARK } from "@/constants/job-copy";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

export interface JobPlaylistSelectProps {
  readonly playlists: readonly AdminPlaylist[];
  /** The chosen playlist's id as text; `""` when there is none to choose. */
  readonly value: string;
  readonly onChange: (playlistId: string) => void;
  readonly invalid?: boolean;
}

/** The Playlist row's control: a select of the playlist records, read through the playlists service. A disabled
 *  playlist is listed but marked `disabled` (its job refuses to run, with the backend's reason). With no playlist to
 *  choose (none yet, or the read failed) the row is a shimmer line: no invented option. */
export function JobPlaylistSelect({ playlists, value, onChange, invalid = false }: JobPlaylistSelectProps) {
  if (playlists.length === 0) {
    return (
      <span className="flex h-9 w-full items-center" aria-hidden>
        <span className={SHIMMER} style={{ width: "44%" }} />
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
