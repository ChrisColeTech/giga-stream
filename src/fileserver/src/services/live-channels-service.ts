import type { AdminClient, AdminFailure } from "./admin-client.js";
import { summaryOf, withVerdicts } from "./live-view.js";
import type { StreamProbe } from "./stream-probe.js";
import type { ChannelList, ChannelSummary } from "../types/channel.js";

/** The live view's backend facts for the state answer (docs/03 section 4). */
export interface BackendState {
  url: string;
  connected: boolean;
  revision?: number;
  readAt?: number;
  error?: { code: string; message: string };
}

export interface LiveViewRead {
  list: ChannelList;
  backend: BackendState;
}

/**
 * The live view (docs/03 sections 3.4, 5.1, 5.2): the backend's channels in memory, read on demand,
 * never stored. A fill probes every stream and the answer carries the round's statuses. There is no
 * socket: reachability is a fact of the last read, and a failed read clears the view.
 */
export function createLiveChannelsService(deps: {
  admin: AdminClient;
  probe: StreamProbe;
  adminUrl: () => string;
  ttlMs: number;
  now: () => number;
  /**
   * Every image address the fileserver passes on is rewritten to the image cache (03 section 3.11):
   * a channel's logo becomes `/api/images/<imageId>`. A source that fails the address rule is
   * returned unchanged; the interface shows its fallback.
   */
  rewriteImageUrl: (source: string) => string;
}) {
  const { admin, probe, adminUrl, ttlMs, now, rewriteImageUrl } = deps;

  let view: ChannelSummary[] = [];
  let revision = 0;
  let readAt: number | undefined;
  let error: { code: string; message: string } | undefined;

  function backendState(): BackendState {
    return {
      url: adminUrl(),
      connected: error === undefined && readAt !== undefined,
      ...(revision !== 0 && { revision }),
      ...(readAt !== undefined && { readAt }),
      ...(error !== undefined && { error }),
    };
  }

  /** Categories counted over the whole view, whatever the query narrows. */
  function toList(narrowed: ChannelSummary[]): ChannelList {
    const categories = new Map<string, number>();
    for (const channel of view) categories.set(channel.category, (categories.get(channel.category) ?? 0) + 1);
    return {
      items: narrowed,
      categories: [...categories.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value)),
      revision,
    };
  }

  function ordered(items: readonly ChannelSummary[]): ChannelSummary[] {
    return [...items].sort((a, b) => {
      const numberA = a.number !== undefined && a.number !== "" ? Number(a.number) : undefined;
      const numberB = b.number !== undefined && b.number !== "" ? Number(b.number) : undefined;
      if (numberA !== undefined && numberB !== undefined && numberA !== numberB) return numberA - numberB;
      if (numberA !== undefined && numberB === undefined) return -1;
      if (numberA === undefined && numberB !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Fill the view from the backend. Never throws: a failure clears the view and is carried as the
   * backend error, so the caller can answer `503`/`502` from it (docs/03 section 5.1).
   */
  async function fill(): Promise<AdminFailure | undefined> {
    const before = new Map(view.map((channel) => [channel.id, channel]));
    const answer = await admin.channels(adminUrl());
    if (!answer.ok) {
      view = [];
      revision = 0;
      readAt = now();
      error = { code: answer.failure.code, message: answer.failure.message };
      return answer.failure;
    }
    // The logos go through the image cache before the view keeps them (03 section 3.11); the view
    // itself is never stored anywhere (5.1).
    view = answer.value.items.map((channel) =>
      summaryOf(
        channel.logoUrl === undefined ? channel : { ...channel, logoUrl: rewriteImageUrl(channel.logoUrl) },
        before,
      ),
    );
    revision = answer.value.revision;
    readAt = now();
    error = undefined;
    const verdicts = await probe.checkAll(view.map((channel) => channel.streamUrl));
    view = withVerdicts(view, verdicts, now());
    return undefined;
  }

  /** Read for an answer: fill when empty or stale, then serve from the view. */
  async function read(query: { q?: string; category?: string }, force: boolean): Promise<LiveViewRead | { failure: AdminFailure }> {
    const stale = readAt === undefined || now() - readAt >= ttlMs;
    if (view.length === 0 || stale || force) {
      const failure = await fill();
      if (failure) return { failure };
    }
    const q = query.q?.toLowerCase();
    const narrowed = view.filter((channel) => {
      const matchesQ = q === undefined || channel.name.toLowerCase().includes(q) || (channel.number ?? "").includes(q);
      const matchesCategory = query.category === undefined || channel.category === query.category;
      return matchesQ && matchesCategory;
    });
    return { list: toList(ordered(narrowed)), backend: backendState() };
  }

  return {
    /** `GET /api/channels`: the matching channels as a `ChannelList` (docs/03 section 3.4). */
    async list(query: { q?: string; category?: string }): Promise<LiveViewRead | { failure: AdminFailure }> {
      return read(query, false);
    },
    /** `POST /api/channels/refresh`: read and probe again regardless of the TTL. */
    async refresh(): Promise<LiveViewRead | { failure: AdminFailure }> {
      return read({}, true);
    },
    /** The last channel, reported only while it is in the view (docs/03 section 3.4). */
    lastId(fromStore: () => string | undefined): string | undefined {
      const stored = fromStore();
      return stored !== undefined && view.some((channel) => channel.id === stored) ? stored : undefined;
    },
    backend: backendState,
    /** Test seam: the view as it stands. */
    peek: (): ChannelSummary[] => view,
  };
}

export type LiveChannelsService = ReturnType<typeof createLiveChannelsService>;
