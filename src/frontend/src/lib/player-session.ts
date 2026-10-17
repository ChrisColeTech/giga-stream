import { PLAYER_TAB_LIMIT } from "@/lib/player-copy";
import { formatEpisodeCode } from "@/lib/player-format";
import type { ItemRef, LibraryItem } from "@/types/library";
import type { PlayerTab } from "@/types/player";

/** The Player's ephemeral state (`21` section 1: component state in phase 1). Pure data; the reducer below is the only
 *  thing that changes it, so every tab rule is testable without React. */
export interface PlayerSession {
  readonly tabs: readonly PlayerTab[];
  readonly activeId: string | null;
  /** The tick of each tab's last use, for the least-recently-used rule. */
  readonly usedAt: Readonly<Record<string, number>>;
  readonly clock: number;
  /** The season a series tab's browser shows, by tab id. */
  readonly seasonByTab: Readonly<Record<string, number>>;
  /** Favourite overrides by item id; absent means the library's own value. */
  readonly favorites: Readonly<Record<string, boolean>>;
  /** The collections each item is in, by item id. */
  readonly membership: Readonly<Record<string, readonly string[]>>;
  readonly relatedFolded: boolean;
}

export type PlayerAction =
  | { readonly type: "open"; readonly tab: PlayerTab }
  | { readonly type: "activate"; readonly id: string }
  | { readonly type: "close"; readonly id: string }
  | { readonly type: "closeOthers"; readonly id: string }
  | { readonly type: "season"; readonly id: string; readonly season: number }
  | { readonly type: "episode"; readonly id: string; readonly season: number; readonly episode: number }
  | { readonly type: "favorite"; readonly itemId: string; readonly value: boolean }
  | { readonly type: "toggleMember"; readonly itemId: string; readonly collectionId: string }
  | { readonly type: "toggleRelated" };

/** Two references name the same thing when their kind and id match. */
export function sameRef(a: ItemRef, b: ItemRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** The tab a library item opens: one per title, identified by its reference (`06` section 5.1). */
export function tabFromItem(item: LibraryItem): PlayerTab {
  return { id: `tab-${item.ref.id}`, ref: item.ref, kind: item.kind, title: item.title };
}

export function createPlayerSession(
  tabs: readonly PlayerTab[],
  activeId: string | null,
  membership: Readonly<Record<string, readonly string[]>>,
): PlayerSession {
  const usedAt: Record<string, number> = {};
  tabs.forEach((tab, index) => {
    usedAt[tab.id] = index + 1;
  });
  return {
    tabs,
    activeId,
    usedAt,
    clock: tabs.length,
    seasonByTab: {},
    favorites: {},
    membership,
    relatedFolded: false,
  };
}

function touch(session: PlayerSession, id: string): PlayerSession {
  const clock = session.clock + 1;
  return { ...session, clock, usedAt: { ...session.usedAt, [id]: clock } };
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

function only<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name === key));
}

/** The inactive tab used longest ago; the active tab is never a candidate. */
function leastRecentlyUsed(session: PlayerSession): PlayerTab | undefined {
  let oldest: PlayerTab | undefined;
  let oldestTick = Infinity;
  for (const tab of session.tabs) {
    if (tab.id === session.activeId) continue;
    const tick = session.usedAt[tab.id] ?? 0;
    if (tick < oldestTick) {
      oldest = tab;
      oldestTick = tick;
    }
  }
  return oldest;
}

function openTab(session: PlayerSession, tab: PlayerTab): PlayerSession {
  const existing = session.tabs.find((candidate) => sameRef(candidate.ref, tab.ref));
  if (existing !== undefined) return touch({ ...session, activeId: existing.id }, existing.id);

  let tabs = session.tabs;
  let usedAt = session.usedAt;
  if (tabs.length >= PLAYER_TAB_LIMIT) {
    const victim = leastRecentlyUsed(session);
    if (victim !== undefined) {
      tabs = tabs.filter((candidate) => candidate.id !== victim.id);
      usedAt = without(usedAt, victim.id);
    }
  }
  return touch({ ...session, tabs: [...tabs, tab], usedAt, activeId: tab.id }, tab.id);
}

function closeTab(session: PlayerSession, id: string): PlayerSession {
  const index = session.tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return session;
  const tabs = session.tabs.filter((tab) => tab.id !== id);
  const base = {
    ...session,
    tabs,
    usedAt: without(session.usedAt, id),
    seasonByTab: without(session.seasonByTab, id),
  };
  if (session.activeId !== id) return base;
  /* The tab that took the closed one's place, or the one before it when it was last. */
  const neighbour = tabs.at(index) ?? tabs.at(index - 1);
  if (neighbour === undefined) return { ...base, activeId: null };
  return touch({ ...base, activeId: neighbour.id }, neighbour.id);
}

function closeOthers(session: PlayerSession, id: string): PlayerSession {
  const keep = session.tabs.find((tab) => tab.id === id);
  if (keep === undefined) return session;
  return touch(
    {
      ...session,
      tabs: [keep],
      activeId: keep.id,
      usedAt: only(session.usedAt, keep.id),
      seasonByTab: only(session.seasonByTab, keep.id),
    },
    keep.id,
  );
}

/** Choosing an exact episode reuses the tab and rewrites its subtitle; nothing loads in phase 1. */
function chooseEpisode(session: PlayerSession, id: string, season: number, episode: number): PlayerSession {
  const subtitle = formatEpisodeCode(season, episode);
  return {
    ...session,
    tabs: session.tabs.map((tab) => (tab.id === id ? { ...tab, subtitle } : tab)),
    seasonByTab: { ...session.seasonByTab, [id]: season },
  };
}

function toggleMember(session: PlayerSession, itemId: string, collectionId: string): PlayerSession {
  const current = session.membership[itemId] ?? [];
  const next = current.includes(collectionId)
    ? current.filter((id) => id !== collectionId)
    : [...current, collectionId];
  return { ...session, membership: { ...session.membership, [itemId]: next } };
}

export function reducePlayerSession(session: PlayerSession, action: PlayerAction): PlayerSession {
  switch (action.type) {
    case "open":
      return openTab(session, action.tab);
    case "activate":
      return session.tabs.some((tab) => tab.id === action.id) ? touch({ ...session, activeId: action.id }, action.id) : session;
    case "close":
      return closeTab(session, action.id);
    case "closeOthers":
      return closeOthers(session, action.id);
    case "season":
      return { ...session, seasonByTab: { ...session.seasonByTab, [action.id]: action.season } };
    case "episode":
      return chooseEpisode(session, action.id, action.season, action.episode);
    case "favorite":
      return { ...session, favorites: { ...session.favorites, [action.itemId]: action.value } };
    case "toggleMember":
      return toggleMember(session, action.itemId, action.collectionId);
    case "toggleRelated":
      return { ...session, relatedFolded: !session.relatedFolded };
  }
}
