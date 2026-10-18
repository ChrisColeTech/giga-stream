import type { TitleSource } from "@/services/schemas/source-schema";

export type PlayerSource =
  | { readonly id: string; readonly kind: "embed"; readonly name: string; readonly embed: TitleSource }
  | { readonly id: string; readonly kind: "stream"; readonly name: string; readonly url: string };

export function playableSources(sources: readonly TitleSource[] | undefined, streamUrl: string | undefined): PlayerSource[] {
  const providers = [...(sources ?? [])]
    .sort((left, right) => left.order - right.order || left.providerId - right.providerId)
    .map((embed): PlayerSource => ({ id: `provider:${embed.providerId}`, kind: "embed", name: embed.name, embed }));
  if (streamUrl !== undefined) providers.push({ id: "app", kind: "stream", name: "App player", url: streamUrl });
  return providers;
}

export function localSource(url: string): PlayerSource {
  return { id: "local", kind: "stream", name: "Local file", url };
}

export function hasSourceChoice(sources: readonly PlayerSource[]): boolean {
  return sources.length >= 2;
}

/** Uses the committed choice when valid, otherwise the first source while the store synchronizes. */
export function selectedPlayerSource(
  sources: readonly PlayerSource[],
  activeId: string | null,
): PlayerSource | undefined {
  return sources.find((source) => source.id === activeId) ?? sources[0];
}

/** Whether two source lists carry the same media: same ids, kinds, names and addresses (a provider by its id), in
 *  order. A re-read that answers the same sources recomputes the list into new objects; the stage must not treat
 *  that as a change (`50` section 2.4's stop fix): the write would force the stage back to `loading`, which no
 *  media event then advances while the mounted element keeps playing. */
export function sameSources(left: readonly PlayerSource[], right: readonly PlayerSource[]): boolean {
  return left.length === right.length && left.every((source, at) => {
    const other = right[at];
    if (other === undefined || source.id !== other.id || source.kind !== other.kind || source.name !== other.name) {
      return false;
    }
    return source.kind === "embed"
      ? other.kind === "embed" && source.embed.providerId === other.embed.providerId
      : other.kind === "stream" && source.url === other.url;
  });
}
