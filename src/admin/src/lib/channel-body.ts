import { CATEGORIES } from "@/constants/channel-copy";
import type { AdminChannel, LiveAdminChannel, StreamAdminChannel } from "@/types/admin-channel";
import { liveDraft, streamDraft, type LiveDraft, type StreamDraft } from "./channel-draft";

/* The request bodies of the Channels tab (`36` sections 3.1 and 3.2). Pure. A create body never carries an `id`: the
 * backend assigns a live channel's (`live-<uuid>`) as it does a stream channel's. A PATCH carries only the fields that
 * changed; `folder` and `videos` only when the source changed, and then only the one the channel now plays. A channel
 * number is never sent (there is no guide: owner, 2026-10-17); a channel that has one keeps it. */

/** The New channel form's values: Name, Kind, Category, then Folder (live) or Stream address (stream). */
export interface NewChannelDraft {
  readonly name: string;
  readonly kind: "live" | "stream";
  readonly category: string;
  readonly folder: string;
  readonly streamUrl: string;
}

export const EMPTY_NEW_CHANNEL: NewChannelDraft = {
  name: "",
  kind: "live",
  category: CATEGORIES[0] ?? "News",
  folder: "",
  streamUrl: "",
};

export const sameNewChannel = (a: NewChannelDraft, b: NewChannelDraft): boolean =>
  a.name === b.name &&
  a.kind === b.kind &&
  a.category === b.category &&
  a.folder === b.folder &&
  a.streamUrl === b.streamUrl;

/** Switching Kind keeps what was typed; a live channel's category must be one of the six, so a free-text one gives way
 *  to the first. */
export function withKind(draft: NewChannelDraft, kind: NewChannelDraft["kind"]): NewChannelDraft {
  const listed = CATEGORIES.some((category) => category === draft.category);
  return { ...draft, kind, category: kind === "live" && !listed ? EMPTY_NEW_CHANNEL.category : draft.category };
}

export type ChannelBody = Readonly<Record<string, unknown>>;

/** `POST /api/channels`: the trimmed values the kind uses, and no id. */
export function createBody(draft: NewChannelDraft): ChannelBody {
  const base = { kind: draft.kind, name: draft.name.trim(), category: draft.category.trim() };
  return draft.kind === "live" ? { ...base, folder: draft.folder.trim() } : { ...base, streamUrl: draft.streamUrl.trim() };
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

function livePatch(channel: LiveAdminChannel, draft: LiveDraft): Record<string, unknown> {
  const was = liveDraft(channel);
  const patch: Record<string, unknown> = {};
  if (draft.name.trim() !== was.name) patch["name"] = draft.name.trim();
  if (draft.category !== was.category) patch["category"] = draft.category;
  if (draft.enabled !== was.enabled) patch["enabled"] = draft.enabled;
  if (draft.mode !== was.mode) patch["mode"] = draft.mode;
  if (draft.captions !== was.captions) patch["captions"] = draft.captions;
  if (!sameList(draft.variants, was.variants)) patch["variants"] = [...draft.variants];
  if (draft.plays === "folder" && (was.plays !== "folder" || draft.folder.trim() !== was.folder)) {
    patch["folder"] = draft.folder.trim();
  }
  if (draft.plays === "videos" && (was.plays !== "videos" || !sameList(draft.videos, was.videos))) {
    patch["videos"] = [...draft.videos];
  }
  return patch;
}

function streamPatch(channel: StreamAdminChannel, draft: StreamDraft): Record<string, unknown> {
  const was = streamDraft(channel);
  const patch: Record<string, unknown> = {};
  for (const key of ["name", "category", "streamUrl", "logoUrl"] as const) {
    if (draft[key].trim() !== was[key]) patch[key] = draft[key].trim();
  }
  if (draft.enabled !== was.enabled) patch["enabled"] = draft.enabled;
  return patch;
}

/** `PATCH /api/channels/:id`: only what differs from the saved channel. A draft of the other kind changes nothing. */
export function patchBody(channel: AdminChannel, draft: LiveDraft | StreamDraft): ChannelBody {
  if (channel.kind === "live") return draft.kind === "live" ? livePatch(channel, draft) : {};
  return draft.kind === "stream" ? streamPatch(channel, draft) : {};
}

export const isEmptyBody = (body: ChannelBody): boolean => Object.keys(body).length === 0;
