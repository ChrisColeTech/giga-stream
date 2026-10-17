import { useEffect, useReducer, useRef, useState } from "react";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import { PlayerStage } from "@/components/player/PlayerStage";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { changeFavourite, changeMembership, reportRefusal } from "@/components/library/library-service";
import { INITIAL_ITEM } from "@/fixtures/player";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import type { PlayerCommands } from "@/lib/player-commands";
import { createPlayerSession, isOpen, itemFromLibrary, reducePlayerSession } from "@/lib/player-session";
import { viewOf } from "@/lib/player-view";
import { retryStream } from "@/services/channels";
import { playEpisode, playItem, removeHistoryEntry } from "@/services/library";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

const INITIAL_SESSION = createPlayerSession(INITIAL_ITEM);

/** Asks the fileserver to start what opening an item starts. A movie or a local file starts at once; a series starts
 *  only when it was left partway on an exact episode, else the browser waits for an episode to be chosen. */
function startOnOpen(item: LibraryItem): void {
  const progress = item.progress;
  if (item.kind !== "tv") reportRefusal(playItem(item.ref));
  else if (progress?.season !== undefined && progress.episode !== undefined)
    reportRefusal(playEpisode(item.ref, progress.season, progress.episode));
}

/** Player: the browser on the left, the stage in the centre, the inspector on the right, and the related band along the
 *  bottom. One title or file at a time. Local presses change the session here; fileserver presses call the service and
 *  report a refusal on the notice line. Favourites and memberships are the store's marks, shared with Library. With
 *  nothing open the panes are skeletons and the stage is the player alone. */
export function PlayerPage({ active }: { active: boolean }) {
  const [session, dispatch] = useReducer(reducePlayerSession, INITIAL_SESSION);
  /* The serial of the last play request acted on, so a session change alone never re-runs one. */
  const handled = useRef(0);
  /* The video's paused state, reported by the stage; a video that has not started is paused. */
  const [paused, setPaused] = useState(true);
  const marks = useAppStore((state) => state.marks);
  const setSurface = useAppStore((state) => state.setSurface);
  const requestLibrary = useAppStore((state) => state.requestLibrary);
  const view = viewOf(session, marks);
  const ref = view.tab?.ref;

  /* A Play from anywhere opens the item here at once. The item already open is only shown; anything else is opened and
     its stream asked for. */
  const playRequest = useAppStore((state) => state.playRequest);
  useEffect(() => {
    if (playRequest === null || playRequest.serial === handled.current) return;
    handled.current = playRequest.serial;
    if (isOpen(session, playRequest.ref)) return;
    const item = LIBRARY_ITEMS.find((entry) => entry.ref.kind === playRequest.ref.kind && entry.ref.id === playRequest.ref.id);
    if (item === undefined) return;
    dispatch({ type: "open", item: itemFromLibrary(item) });
    startOnOpen(item);
  }, [playRequest, session]);

  const commands: PlayerCommands = {
    retry: () => reportRefusal(retryStream()),
    reveal: () => (ref === undefined ? setSurface("library") : requestLibrary({ select: ref })),
    close: () => dispatch({ type: "close" }),
    resume: () => {
      if (ref !== undefined) reportRefusal(playItem(ref));
    },
    startOver: () => {
      if (ref !== undefined) reportRefusal(playItem(ref));
    },
    favorite: (value) => {
      if (ref !== undefined) changeFavourite(ref, value);
    },
    toggleMember: (collectionId) => {
      if (ref !== undefined) changeMembership(ref, collectionId, !view.memberIds.includes(collectionId), view.memberIds);
    },
    removeHistory: (watchId) => reportRefusal(removeHistoryEntry(watchId)),
    openRelated: (item) => {
      if (isOpen(session, item.ref)) return;
      dispatch({ type: "open", item: itemFromLibrary(item) });
      startOnOpen(item);
    },
  };

  return (
    <WorkspaceSplit
      surface="player"
      active={active}
      left={
        <PlayerBrowser
          view={view}
          onSeason={(season) => dispatch({ type: "season", season })}
          onEpisode={(season, episode) => {
            dispatch({ type: "episode", season, episode });
            if (ref !== undefined) reportRefusal(playEpisode(ref, season, episode));
          }}
        />
      }
      center={<PlayerStage view={view} commands={commands} onPausedChange={setPaused} />}
      right={<PlayerInspector view={view} commands={commands} paused={paused} />}
      bottom={<PlayerRelated view={view} commands={commands} />}
    />
  );
}
