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
