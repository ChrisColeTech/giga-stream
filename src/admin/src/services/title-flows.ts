import { AUDIT_AFTER_WRITE, AUDIT_PAGE } from "@/constants/audit-limits";
import { TITLE_GONE, titleCreated, titleDeleted, titleReverted, titleSaved } from "@/constants/title-copy";
import { isEmptyTitleBody, titleChanges, titleCreateBody } from "@/lib/title-body";
import { firstCreateRefusal, firstSaveRefusal, type TitleField } from "@/lib/title-checks";
import type { NewTitleDraft, TitleDraft } from "@/lib/title-draft";
import { loadedRows } from "@/lib/title-paged";
import { findTitle, isManualTitle } from "@/lib/title-rows";
import { DROPPED, codeOf, done, refusalOf, type FlowRefused } from "./provider-flow-support";
import type { AdminTitleDetail } from "./schemas/title-schema";
import { createTitleDeletedFlow, type TitleDeletedFlow } from "./title-deleted-flow";
import {
  createTitleListFlow,
  titlePorts,
  type TitleListFlow,
  type TitleResult,
  type TitleStore,
} from "./title-list-flow";
import { createTitleStoredFlow, type TitleStoredFlow } from "./title-stored-flow";
import type { TitlesService } from "./titles";

export type { TitleResult } from "./title-list-flow";

export interface TitleFlowDeps {
  readonly service: TitlesService;
  readonly store: () => TitleStore;
  /** Reads the audit tail again (`limit` entries); never rejects. */
  readonly audit: { readonly reload: (limit?: number) => Promise<void> };
}

export interface TitleFlows extends TitleListFlow, TitleDeletedFlow, TitleStoredFlow {
  /** The list and the audit tail, read together (the list's Refresh). */
  refresh: () => Promise<TitleResult>;
  create: (draft: NewTitleDraft) => Promise<TitleResult>;
  /** Null when nothing changed; the saved title otherwise. */
  save: (id: string, draft: TitleDraft) => Promise<TitleResult<AdminTitleDetail | null>>;
  remove: (id: string) => Promise<TitleResult>;
  revert: (id: string) => Promise<TitleResult>;
  /** Reads the open workspace's title: the fields a list row lacks. */
  detail: (id: string) => Promise<TitleResult>;
}

const NOT_FOUND = "title.not_found";
const BAD_ANSWER = "backend.bad_response";

/** The Titles tab's orchestration (`37` sections 4.2 and 4.3). Every flow records the session's serial before it
 *  awaits and writes only if the session is unchanged after; a failure is one `warn` notice and a typed result, so the
 *  form can put a field's refusal under its row. A save or a revert answers the stored record (no sources: those are
 *  derived on a detail read), so the open detail keeps the sources it had. */
export function createTitleFlows(deps: TitleFlowDeps): TitleFlows {
  const { service, store, audit } = deps;
  const list = createTitleListFlow(deps);
  const deletedFlow = createTitleDeletedFlow(deps);
  const storedFlow = createTitleStoredFlow(deps);
  const ports = titlePorts(store);
  /** Reads again the list the tab shows: the stored titles, or the TMDB browse page. */
  const reload = (): Promise<TitleResult> =>
    store().titlesStored.mode === "stored" ? storedFlow.loadStored() : list.load();
  const alive = (serial: number): boolean => store().signedIn && store().serial === serial;
  const rejected = (sentence: string, field?: TitleField): FlowRefused<TitleField> => {
    store().say(sentence, "warn", "Title");
    return { ok: false, sentence, ...(field !== undefined && { field }) };
  };
  const afterFailure = (error: unknown): FlowRefused<TitleField> => {
    const code = codeOf(error);
    if (code === NOT_FOUND && store().workspaces.titles !== null) store().closeWorkspace("titles");
    const result = refusalOf(ports, error);
    if (code === NOT_FOUND || code === BAD_ANSWER) void reload();
    return result;
  };
  /** A write's answer: the row in the list, and the open detail with the sources it already had. */
  const adopt = (answer: AdminTitleDetail): void => {
    store().titleUpsert(answer);
    const open = store().titles.detail;
    if (open?.id === answer.id) store().titleDetailLoaded({ ...answer, sources: open.value?.sources });
  };

  async function create(draft: NewTitleDraft): Promise<TitleResult> {
    const bad = firstCreateRefusal(draft);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const serial = store().serial;
    try {
      const title = await service.create(titleCreateBody(draft));
      if (!alive(serial)) return DROPPED;
      store().titleUpsert(title);
      if (store().titlesStored.status !== "idle") void storedFlow.loadStored(); // a new row's place depends on the sort
      store().say(titleCreated(title.title));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function save(id: string, draft: TitleDraft): Promise<TitleResult<AdminTitleDetail | null>> {
    const open = store().titles.detail;
    const saved = open?.id === id ? open.value : null;
    if (saved === null) return rejected(TITLE_GONE);
    const shape = { manual: isManualTitle(saved), series: saved.kind === "tv" };
    const bad = firstSaveRefusal(draft, shape);
    if (bad !== null) return rejected(bad.sentence, bad.field);
    const body = titleChanges(saved, draft, shape);
    if (isEmptyTitleBody(body)) return done(null);
    const serial = store().serial;
    try {
      const answer = await service.update(id, body);
      if (!alive(serial)) return DROPPED;
      adopt(answer);
      store().say(titleSaved(answer.title));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(answer);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function remove(id: string): Promise<TitleResult> {
    const title =
      findTitle(store().titles.items, id) ??
      findTitle(loadedRows(store().titlesStored.paged), id) ??
      store().titles.detail?.value ??
      undefined;
    const serial = store().serial;
    try {
      await service.remove(id);
      if (!alive(serial)) return DROPPED;
      store().titleRemove(id);
      if (store().titlesStored.status !== "idle") void storedFlow.loadStored(); // the rows after it moved up one
      if (store().workspaces.titles === id) store().closeWorkspace("titles");
      store().say(titleDeleted(title?.title ?? id));
      void audit.reload(AUDIT_AFTER_WRITE);
      if (title === undefined || !isManualTitle(title)) void deletedFlow.loadDeleted(); // a synced title stays deleted
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function revert(id: string): Promise<TitleResult> {
    const serial = store().serial;
    try {
      const answer = await service.revert(id);
      if (!alive(serial)) return DROPPED;
      adopt(answer);
      store().say(titleReverted(answer.title));
      void audit.reload(AUDIT_AFTER_WRITE);
      return done(undefined);
    } catch (error: unknown) {
      return alive(serial) ? afterFailure(error) : DROPPED;
    }
  }

  async function detail(id: string): Promise<TitleResult> {
    const serial = store().serial;
    store().titleDetailStart(id);
    try {
      const answer = await service.detail(id);
      if (!alive(serial)) return DROPPED;
      store().titleDetailLoaded(answer);
      return done(undefined);
    } catch (error: unknown) {
      if (!alive(serial)) return DROPPED;
      store().titleDetailFailed(id);
      return afterFailure(error);
    }
  }

  const refresh = async (): Promise<TitleResult> => {
    const [result] = await Promise.all([reload(), audit.reload(AUDIT_PAGE), deletedFlow.loadDeleted()]);
    return result;
  };

  return { ...list, ...deletedFlow, ...storedFlow, refresh, create, save, remove, revert, detail };
}
