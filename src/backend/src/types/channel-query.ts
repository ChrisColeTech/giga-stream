import { z } from "zod";

import {
  CHANNEL_SEARCH_MAX,
  LIST_OFFSET_MAX,
  LIST_PAGE_MAX,
  SOURCE_HOST_MAX,
} from "../constants/limits.js";
import type { AdminChannel } from "./channel.js";
import type { ChannelState } from "./live-stream.js";

export const CHANNEL_SORTS = ["number", "name", "category", "kind", "source"] as const;
export type ChannelSort = (typeof CHANNEL_SORTS)[number];
export const SORT_DIRS = ["asc", "desc"] as const;
export type SortDir = (typeof SORT_DIRS)[number];
const CHANNEL_STATES = ["preparing", "starting", "live", "restarting", "stopped", "failed"] as const satisfies
  readonly ChannelState[];

/** An empty search or host is no filter at all. */
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value === "" ? undefined : value));
const flag = z.enum(["true", "false"]).optional().transform((value) => (value === undefined ? undefined : value === "true"));

/**
 * The query of `GET /api/admin-channels` (docs/41 section 3.1). `limit` turns paging on; without it no other parameter
 * is accepted, so the bare read stays the old whole answer and a filter is never silently ignored.
 */
export const AdminChannelQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX).optional(),
    offset: z.coerce.number().int().min(0).max(LIST_OFFSET_MAX).optional(),
    q: optionalText(CHANNEL_SEARCH_MAX),
    kind: z.enum(["live", "stream"]).optional(),
    origin: z.enum(["synced", "edited", "manual"]).optional(),
    enabled: flag,
    state: z.enum(CHANNEL_STATES).optional(),
    source: optionalText(SOURCE_HOST_MAX),
    sort: z.enum(CHANNEL_SORTS).optional(),
    dir: z.enum(SORT_DIRS).optional(),
  })
  .refine(({ limit, ...rest }) => limit !== undefined || Object.values(rest).every((value) => value === undefined), {
    message: "limit turns paging on; the other parameters need it",
    path: ["limit"],
  });
export type AdminChannelQuery = z.infer<typeof AdminChannelQuerySchema>;

/** What the repository filters on. `ids` is the live rows whose engine state matched (`state`), applied as a set. */
export interface ChannelFilter {
  q?: string;
  kind?: "live" | "stream";
  origin?: "synced" | "edited" | "manual";
  enabled?: boolean;
  source?: string;
  ids?: readonly string[];
}

export interface ChannelPageRequest {
  filter: ChannelFilter;
  sort: ChannelSort;
  dir: SortDir;
  limit: number;
  offset: number;
}

/** A paged answer: `total` counts the rows after the filters, before `limit`. */
export interface AdminChannelPage {
  items: AdminChannel[];
  revision: number;
  total: number;
  offset: number;
  limit: number;
}
