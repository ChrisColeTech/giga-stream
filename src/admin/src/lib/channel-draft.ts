import type { AdminChannel, LiveAdminChannel, LiveMode, StreamAdminChannel, Variant } from "@/types/admin-channel";

/* A channel workspace's form values (`28` section 7.3): what the person is editing, as the fields hold it. A draft is
 * compared with the saved channel's draft, so `dirty` is a fact about values and never a flag set by typing; typing a
 * value back is clean again. */

export interface LiveDraft {
  readonly kind: "live";
  readonly name: string;
  readonly category: string;
  /** Which of the two sources the channel plays; the other is kept in the draft, not sent. */
  readonly plays: "folder" | "videos";
  readonly folder: string;
  readonly videos: readonly string[];
  readonly enabled: boolean;
  readonly mode: LiveMode;
  readonly captions: boolean;
  readonly variants: readonly Variant[];
}

export interface StreamDraft {
  readonly kind: "stream";
  readonly name: string;
  readonly category: string;
  readonly streamUrl: string;
  readonly logoUrl: string;
  readonly enabled: boolean;
}

export type ChannelDraft = LiveDraft | StreamDraft;

export function liveDraft(channel: LiveAdminChannel): LiveDraft {
  return {
    kind: "live",
    name: channel.name,
    category: channel.category,
    plays: channel.videos === undefined ? "folder" : "videos",
    folder: channel.folder ?? "",
    videos: channel.videos ?? [],
    enabled: channel.enabled,
    mode: channel.mode,
    captions: channel.captions,
    variants: channel.variants,
  };
}

export function streamDraft(channel: StreamAdminChannel): StreamDraft {
  return {
    kind: "stream",
    name: channel.name,
    category: channel.category,
    streamUrl: channel.streamUrl,
    logoUrl: channel.logoUrl ?? "",
    enabled: channel.enabled,
  };
}

export const draftOf = (channel: AdminChannel): ChannelDraft =>
  channel.kind === "live" ? liveDraft(channel) : streamDraft(channel);

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** Do two drafts hold the same values? Videos and qualities compare in order: a reordered list is a change. */
export function sameDraft(a: ChannelDraft, b: ChannelDraft): boolean {
  if (a.kind === "live" && b.kind === "live") {
    return (
      a.name === b.name &&
      a.category === b.category &&
      a.plays === b.plays &&
      a.folder === b.folder &&
      sameList(a.videos, b.videos) &&
      a.enabled === b.enabled &&
      a.mode === b.mode &&
      a.captions === b.captions &&
      sameList(a.variants, b.variants)
    );
  }
  if (a.kind === "stream" && b.kind === "stream") {
    return (
      a.name === b.name &&
      a.category === b.category &&
      a.streamUrl === b.streamUrl &&
      a.logoUrl === b.logoUrl &&
      a.enabled === b.enabled
    );
  }
  return false;
}

/** Does saving this draft over the channel change what the engine builds from? The source, the mode, the captions or the
 *  qualities do (`29` section 10, flow 2): the answer is `preparing`. A name, a category or `Enabled` does not
 *  rebuild by itself. */
export function rebuilds(channel: LiveAdminChannel, draft: LiveDraft): boolean {
  const base = liveDraft(channel);
  const source = draft.plays === "folder" ? draft.folder : draft.videos.join("\n");
  const was = base.plays === "folder" ? base.folder : base.videos.join("\n");
  return (
    draft.plays !== base.plays ||
    source !== was ||
    draft.mode !== base.mode ||
    draft.captions !== base.captions ||
    !sameList(draft.variants, base.variants)
  );
}

/** A quality chip pressed: off if it was on, else on at the end, so the list keeps the order the person chose. */
export const toggleVariant = (variants: readonly Variant[], variant: Variant): Variant[] =>
  variants.includes(variant) ? variants.filter((one) => one !== variant) : [...variants, variant];
