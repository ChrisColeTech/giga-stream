import { useReducer } from "react";
import { PlayerBrowser } from "@/components/player/PlayerBrowser";
import { PlayerInspector } from "@/components/player/PlayerInspector";
import { PlayerRelated } from "@/components/player/PlayerRelated";
import { PlayerStage } from "@/components/player/PlayerStage";
import { PlayerTabs } from "@/components/player/PlayerTabs";
import { WorkspaceSplit } from "@/components/chrome/WorkspaceSplit";
import { ACTIVE_TAB_ID, PLAYER_TABS } from "@/fixtures/player";
import { MEMBERSHIP } from "@/fixtures/collections";
import type { PlayerCommands } from "@/lib/player-commands";
import { createPlayerSession, reducePlayerSession, tabFromItem } from "@/lib/player-session";
import { viewOf } from "@/lib/player-view";
import { retryStream } from "@/services/channels";
import { playItem, removeHistoryEntry, setFavourite, setMembership } from "@/services/library";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";

const INITIAL_SESSION = createPlayerSession(PLAYER_TABS, ACTIVE_TAB_ID, MEMBERSHIP);

/** A refused press reports its sentence once on the notice line, and changes nothing else. */
function reportRefusal(result: ServiceResult, say: (sentence: string, tone: "warn") => void): void {
  if (!result.ok) say(result.message, "warn");
}

/** Player: the browser on the left, the tabs and the stage in the centre, the inspector on the right, and the related band
 *  along the bottom. Local presses change the session here; fileserver presses call the service and change the session
 *  only when it accepts. With no tab open the panes are skeletons and the stage is the player alone. */
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
      if (result.ok) dispatch({ type: "open", tab: tabFromItem(item) });
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
          onSeason={(season) => {
            if (view.tab !== undefined) dispatch({ type: "season", id: view.tab.id, season });
          }}
          onEpisode={(season, episode) => {
            if (view.tab !== undefined) dispatch({ type: "episode", id: view.tab.id, season, episode });
          }}
        />
      }
      center={
        <div className="flex min-h-0 flex-1 flex-col">
          <PlayerTabs
            tabs={session.tabs}
            activeId={session.activeId}
            onActivate={(id) => dispatch({ type: "activate", id })}
            onClose={(id) => dispatch({ type: "close", id })}
            onCloseOthers={(id) => dispatch({ type: "closeOthers", id })}
            onReveal={commands.reveal}
          />
          <PlayerStage view={view} commands={commands} />
        </div>
      }
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
