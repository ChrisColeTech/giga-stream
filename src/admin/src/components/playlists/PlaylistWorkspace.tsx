import { useEffect, type CSSProperties } from "react";
import { useScrollSpy } from "@giga/ui/hooks/useScrollSpy";
import { labelColumn } from "@giga/ui/lib/label-column";
import { WorkspaceFrame } from "@/components/chrome/WorkspaceFrame";
import { DiscardBar } from "@/components/records/DiscardBar";
import { RecordRail } from "@/components/records/RecordRail";
import { WorkspaceToolbar } from "@/components/records/WorkspaceToolbar";
import { SAVING_REASON, UNREACHABLE_REASON } from "@/constants/account-copy";
import {
  PLAYLIST_GONE,
  PLAYLIST_SECTIONS,
  PLAYLIST_SECTION_KEYS,
  PLAYLIST_WORKSPACE_LABELS,
} from "@/constants/playlist-copy";
import { usePlaylistActions } from "@/hooks/usePlaylistActions";
import { usePlaylistChannels } from "@/hooks/usePlaylistChannels";
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
  const requestTab = useAppStore((state) => state.requestTab);
  const spy = useScrollSpy(PLAYLIST_SECTION_KEYS, PLAYLIST_SECTION_KEYS[0] ?? "pw-details");
  const channels = usePlaylistChannels(playlist.host);

  /* The list changed under the workspace (a refresh, a save): a clean form follows the new record; a form being edited
     keeps what the person typed. */
  useEffect(() => {
    const next = draftOf(playlist);
    if (!form.dirty || samePlaylistDraft(form.draft, next)) form.reset(next);
  }, [playlist]);

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
      toolbar={<WorkspaceToolbar label="Playlist toolbar" forward={{ label: "Jobs", onPress: () => requestTab("jobs") }} />}
    >
      <DiscardBar dirty={form.dirty} onDiscard={form.discard} />
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
              save={{
                onPress: () => void save(),
                reason: changeReason(form.dirty, saving ? SAVING_REASON : unreachable ? UNREACHABLE_REASON : undefined),
              }}
            />
          </div>
          <div ref={spy.bind("pw-status")}>
            <PlaylistStatusGroup playlist={playlist} channels={channels} />
          </div>
        </div>
      </div>
    </WorkspaceFrame>
  );
}

/** One playlist's workspace (`38` section 3.3), opened from the list already held: the rail (`‹ Playlists`, Details,
 *  Status), a toolbar with the `Jobs` arrow, the pinned `Discard changes` and one scrolling page whose Details group ends with
 *  `Save details`. If the playlist is no longer
 *  in a read list (deleted elsewhere), the workspace closes with a notice. */
export function PlaylistWorkspace({ id, active }: { readonly id: string; readonly active: boolean }) {
  const playlist = useAppStore((state) => state.playlists.items.find((item) => item.id === idOf(id)));
  const status = useAppStore((state) => state.playlists.status);
  const closeWorkspace = useAppStore((state) => state.closeWorkspace);
  const say = useAppStore((state) => state.say);
  const gone = playlist === undefined && status === "ready";

  useEffect(() => {
    if (!gone) return;
    closeWorkspace("playlists");
    say(PLAYLIST_GONE, "warn", "Playlist");
  }, [gone, closeWorkspace, say]);

  return playlist === undefined ? null : <Editor key={playlist.id} playlist={playlist} active={active} />;
}
