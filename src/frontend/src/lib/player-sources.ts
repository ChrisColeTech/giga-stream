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

/** The address's stable part: scheme, host, port and path — the query and fragment dropped. A play address's query
 *  is the per-request part (a token or signature the source re-mints per answer, the re-drive's finding): it must
 *  not read as a different media, while a different path, host, port or scheme is a genuine change. */
export function stableAddressOf(url: string): string {
  const end = url.search(/[?#]/u);
  return end === -1 ? url : url.slice(0, end);
}

export function sameAddress(left: string, right: string): boolean {
  return stableAddressOf(left) === stableAddressOf(right);
}

/** Whether two source lists carry the same media: same ids, kinds, names and stable addresses (a provider by its
 *  id), in order. A re-read that answers the same sources recomputes the list into new objects — with the play
 *  address's query re-minted; the stage must not treat that as a change: the write would force the stage back to
 *  `loading` and re-point the selection, and the mounted element would be torn down and reloaded at its opening
 *  position. A genuinely different address still reads as a change. */
export function sameSources(left: readonly PlayerSource[], right: readonly PlayerSource[]): boolean {
  return left.length === right.length && left.every((source, at) => {
    const other = right[at];
    if (other === undefined || source.id !== other.id || source.kind !== other.kind || source.name !== other.name) {
      return false;
    }
    return source.kind === "embed"
      ? other.kind === "embed" && sameAddress(source.embed.url, other.embed.url)
      : other.kind === "stream" && sameAddress(source.url, other.url);
  });
}
