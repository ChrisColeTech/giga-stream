import { unreadableTitles } from "@/constants/title-copy";
import { titleFieldOf, type TitleField } from "@/lib/title-checks";
import { mergePages, type TitlePage } from "@/lib/title-merge";
import {
  newer,
  older,
  runSearch,
  titleReads,
  typeSearch,
  withKind,
  withSort,
  type KindChoice,
  type TitleSort,
  type TitleView,
} from "@/lib/title-query";
import type { AppState } from "@/store/app-store";
import { DROPPED, done, isUnreachable, refusalOf, type FlowResult, type RefusalPorts } from "./provider-flow-support";
import type { TitlesService } from "./titles";

/** The part of the store the title flows read and write; `useAppStore.getState` satisfies it, as a test's does. */
export type TitleStore = Pick<
  AppState,
  | "serial"
  | "signedIn"
  | "titles"
  | "workspaces"
  | "titlesSetView"
  | "titlesStartLoad"
  | "titlesLoaded"
  | "titlesLoadFailed"
  | "titleUpsert"
  | "titleRemove"
  | "titlesMarkUnreachable"
  | "titlesStored"
  | "storedType"
  | "storedSetQuery"
  | "storedStart"
  | "storedPageStart"
  | "storedPageLoaded"
  | "storedPageFailed"
  | "storedInvalidate"
  | "titleDetailStart"
  | "titleDetailLoaded"
  | "titleDetailFailed"
  | "titlesDeletedStart"
  | "titlesDeletedLoaded"
  | "titlesDeletedFailed"
  | "titleDeletedRemove"
  | "closeWorkspace"
  | "say"
>;

export type TitleResult<T = undefined> = FlowResult<T, TitleField>;

export const titlePorts = (store: () => TitleStore): RefusalPorts<TitleField> => ({
  say: (sentence, tone, area) => store().say(sentence, tone, area),
  markUnreachable: () => store().titlesMarkUnreachable(true),
  area: "Title",
  fieldOf: titleFieldOf,
});

export interface TitleListFlow {
  /** Reads the list for the current view (first show, Refresh, after a write). */
  load: () => Promise<TitleResult>;
  type: (text: string) => void;
  search: () => Promise<TitleResult>;
  kind: (choice: KindChoice) => Promise<TitleResult>;
  sort: (sort: TitleSort) => Promise<TitleResult>;
  older: () => Promise<TitleResult>;
  newer: () => Promise<TitleResult>;
}

/** The Titles list (`37` section 4.2): a view change sets the view and reads it. With both kinds ticked a search is two
 *  requests merged by title; one that fails keeps the other's rows and says why. An answer for a view that is no longer
 *  the slice's, or from an earlier session, is dropped. With no TMDB token the read is `503 tmdb.unavailable`: the list
 *  keeps its skeleton and the notice says the sentence; nothing is faked. */
export function createTitleListFlow(deps: {
  readonly service: Pick<TitlesService, "list" | "search">;
  readonly store: () => TitleStore;
}): TitleListFlow {
  const { service, store } = deps;
  const ports = titlePorts(store);

  async function read(view: TitleView): Promise<TitleResult> {
    const serial = store().serial;
    store().titlesSetView(view);
    store().titlesStartLoad();
    const answers = await Promise.allSettled(
      titleReads(view).map((one) => (one.route === "browse" ? service.list(one.query) : service.search(one.query))),
    );
    if (!store().signedIn || store().serial !== serial || store().titles.view !== view) return DROPPED;
    const pages: TitlePage[] = [];
    const failures: unknown[] = [];
    let unreadable = 0;
    for (const answer of answers) {
      if (answer.status === "fulfilled") {
        pages.push(answer.value);
        unreadable += answer.value.unreadable;
      } else failures.push(answer.reason);
    }
    if (pages.length === 0) {
      store().titlesLoadFailed(view, failures.some(isUnreachable));
      return refusalOf(ports, failures[0]);
    }
    store().titlesLoaded(view, mergePages(pages, view.page));
    if (failures.length > 0) refusalOf(ports, failures[0]);
    else if (unreadable > 0) store().say(unreadableTitles(unreadable), "warn", "Title");
    return done(undefined);
  }

  const view = (): TitleView => store().titles.view;
  return {
    load: () => read(view()),
    type: (text) => store().titlesSetView(typeSearch(view(), text)),
    search: () => read(runSearch(view())),
    kind: (choice) => {
      const next = withKind(view(), choice);
      return next === view() ? Promise.resolve(done(undefined)) : read(next);
    },
    sort: (sort) => read(withSort(view(), sort)),
    older: () => read(older(view(), store().titles.totalPages)),
    newer: () => read(newer(view())),
  };
}
