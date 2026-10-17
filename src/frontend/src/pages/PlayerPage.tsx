import { useReducer } from "react";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import { PlayerStage } from "@/components/player/PlayerStage";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { ACTIVE_TAB_ID, PLAYER_TABS } from "@/fixtures/player";
import { MEMBERSHIP } from "@/fixtures/collections";
import type { PlayerCommands } from "@/lib/player-commands";
import { createPlayerSession, itemFromLibrary, reducePlayerSession } from "@/lib/player-session";
import { viewOf } from "@/lib/player-view";
import { retryStream } from "@/services/channels";
import { playItem, removeHistoryEntry, setFavourite, setMembership } from "@/services/library";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";

/** The fixture's active item is the one playing when the Player opens (`06` section 5.1: one item at a time). */
const INITIAL_SESSION = createPlayerSession(
  PLAYER_TABS.find((item) => item.id === ACTIVE_TAB_ID) ?? null,
  MEMBERSHIP,
);

/** A refused press reports its sentence once on the notice line, and changes nothing else. */
function reportRefusal(result: ServiceResult, say: (sentence: string, tone: "warn") => void): void {
  if (!result.ok) say(result.message, "warn");
}

/** Player: the browser on the left, the stage in the centre, the inspector on the right, and the related band along the
 *  bottom. One title or file at a time. Local presses change the session here; fileserver presses call the service and
 *  change the session only when it accepts. With nothing open the panes are skeletons and the stage is the player alone. */
export function PlayerPage({ active }: { active: boolean }) {
  const [session, dispatch] = useReducer(reducePlayerSession, INITIAL_SESSION);
  const say = useAppStore((state) => state.say);
  const setSurface = useAppStore((state) => state.setSurface);
  const view = viewOf(session);
  const ref = view.tab?.ref;
  const refuse = (result: ServiceResult) => reportRefusal(result, say);

  const commands: PlayerCommands = {
    retry: () => refuse(retryStream()),
    reveal: () => setSurface("library"),
    close: () => dispatch({ type: "close" }),
    resume: () => {
      if (ref !== undefined) refuse(playItem(ref));
    },
    startOver: () => {
      if (ref !== undefined) refuse(playItem(ref));
    },
    favorite: (value) => {
      if (ref === undefined) return;
      const result = setFavourite(ref, value);
      if (result.ok) dispatch({ type: "favorite", itemId: ref.id, value });
      else refuse(result);
    },
    toggleMember: (collectionId) => {
      if (ref === undefined) return;
      const result = setMembership(collectionId, ref, !view.memberIds.includes(collectionId));
      if (result.ok) dispatch({ type: "toggleMember", itemId: ref.id, collectionId });
      else refuse(result);
    },
    removeHistory: (watchId) => refuse(removeHistoryEntry(watchId)),
    openRelated: (item) => {
      const result = playItem(item.ref);
      if (result.ok) dispatch({ type: "open", item: itemFromLibrary(item) });
      else refuse(result);
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
          onEpisode={(season, episode) => dispatch({ type: "episode", season, episode })}
        />
      }
      center={<PlayerStage view={view} commands={commands} />}
      right={<PlayerInspector view={view} commands={commands} />}
      bottom={
        <PlayerRelated
          view={view}
          folded={session.relatedFolded}
          onToggle={() => dispatch({ type: "toggleRelated" })}
          commands={commands}
        />
      }
    />
  );
}
