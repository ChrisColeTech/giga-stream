import type { CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import {
  PLAYLIST_GONE,
  PLAYLIST_SECTIONS,
  PLAYLIST_SECTION_KEYS,
  PLAYLIST_WORKSPACE_LABELS,
} from "@/constants/playlist-copy";
import { useFollowRecord } from "@/hooks/useFollowRecord";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { useWorkspaceGone } from "@/hooks/useWorkspaceGone";
import { usePlaylistChannelsVerb } from "@/hooks/usePlaylistChannelsVerb";
import { useRecordForm } from "@/hooks/useRecordForm";
import { draftOf, samePlaylistDraft } from "@/lib/playlist-draft";
import { idOf } from "@/lib/playlist-rows";
import { changeReason } from "@/lib/workspace-verbs";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";
import { useAppStore } from "@/store/app-store";
import { PlaylistDetailsGroup } from "./PlaylistDetailsGroup";
import { PlaylistStatusGroup } from "./PlaylistStatusGroup";

function Editor({ playlist, active }: { readonly playlist: AdminPlaylist; readonly active: boolean }) {
  const form = useRecordForm({ initial: draftOf(playlist), same: samePlaylistDraft });
  const { flows, saving, track } = usePlaylistActions();
  const unreachable = useAppStore((state) => state.playlists.unreachable);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const spy = useScrollSpy(PLAYLIST_SECTION_KEYS, PLAYLIST_SECTION_KEYS[0] ?? "pw-details");
  const forward = usePlaylistChannelsVerb(playlist);

  useFollowRecord(form, playlist, draftOf, samePlaylistDraft);

  const save = async (): Promise<void> => {
    form.clearErrors();
    const result = await track("save", () => flows.save(playlist.id, form.draft));
    if (result.ok) {
      /* Saved or nothing to send: the address field locks again and its value is gone either way. */
      form.reset(draftOf(result.value ?? playlist));
    } else if (result.dropped !== true && result.field !== undefined) form.setError(result.field, result.sentence);
  };

  return (
    <WorkspaceFrame
      tab="playlists"
      active={active}
      rail={
        <RecordRail
          ariaLabel="Playlist sections"
          back={{ label: "Playlists", onPress: () => closeWorkspace("playlists") }}
          sections={PLAYLIST_SECTIONS}
          spy={spy}
        />
      }
      toolbar={
        <WorkspaceToolbar
          dirty={form.dirty}
          onDiscard={form.discard}
          save={{
            onPress: () => void save(),
            reason: changeReason(form.dirty, saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined),
          }}
          forward={forward}
        />
      }
    >
      <div ref={spy.container} className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <div
          className="flex flex-col px-6 pb-8"
          style={{ "--label-col": labelColumn(PLAYLIST_WORKSPACE_LABELS) } as CSSProperties}
        >
          <div ref={spy.bind("pw-details")}>
            <PlaylistDetailsGroup
              playlist={playlist}
              draft={form.draft}
              errors={form.errors}
              onChange={form.set}
            />
          </div>
          <div ref={spy.bind("pw-status")}>
            <PlaylistStatusGroup playlist={playlist} />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One playlist's workspace (`38` section 3.3), opened from the list already held: the rail (`‹ Playlists`, Details,
 *  Status), the page toolbar (`Discard changes` left; `Save`, then `Channels →` rightmost: it opens the Channels list
 *  filtered to this playlist) and one scrolling page. If the playlist is no longer in a read
 *  list (deleted elsewhere), the workspace closes with a notice. */
export function PlaylistWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const playlist = useAppStore((state) => state.playlists.items.find((item) => item.id === idOf(id)));
  const status = useAppStore((state) => state.playlists.status);
  useWorkspaceGone("playlists", playlist === undefined && status === "ready", PLAYLIST_GONE, "Playlist");

  return playlist === undefined ? null : <Editor key={playlist.id} playlist={playlist} active={active} />;
}
