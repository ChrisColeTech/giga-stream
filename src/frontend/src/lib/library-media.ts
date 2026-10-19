import type { ChoicePopoverMultiProps, ChoicePopoverOption } from "@giga/ui/types/choice-popover";
import type { LibraryKind, LibraryMediaTypes } from "@/types/library";

export type MediaScope = LibraryMediaTypes;

export const ALL_MEDIA = ["movie", "tv", "local"] as const;

export const MEDIA_OPTIONS: readonly ChoicePopoverOption<LibraryKind>[] = [
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "local", label: "Local" },
];

const MEDIA_ALL = { label: "All", values: ALL_MEDIA } as const;

export function mediaSummary(scope: MediaScope): string {
  if (scope.length === ALL_MEDIA.length) return "All";
  return MEDIA_OPTIONS.filter((option) => hasMedia(scope, option.value)).map((option) => option.label).join(" + ");
}

export function mediaChoice(
  values: MediaScope,
  onChange: (values: MediaScope) => void,
): Omit<ChoicePopoverMultiProps<LibraryKind>, "trigger"> {
  return {
    mode: "multi",
    label: "Media",
    values,
    options: MEDIA_OPTIONS,
    all: MEDIA_ALL,
    summary: mediaSummary(values),
    onChange: (next) => onChange(canonicalMedia(next)),
  };
}

export function canonicalMedia(values: readonly LibraryKind[]): MediaScope {
  const movie = values.includes("movie");
  const tv = values.includes("tv");
  const local = values.includes("local");
  if (movie && tv && local) return ALL_MEDIA;
  if (movie && tv) return ["movie", "tv"];
  if (movie && local) return ["movie", "local"];
  if (tv && local) return ["tv", "local"];
  if (movie) return ["movie"];
  if (tv) return ["tv"];
  if (local) return ["local"];
  return ALL_MEDIA;
}

export function isAllMedia(scope: MediaScope): boolean {
  return scope.length === ALL_MEDIA.length && ALL_MEDIA.every((kind, index) => scope[index] === kind);
}

export function hasMedia(scope: MediaScope, kind: LibraryKind): boolean {
  return scope.some((selected) => selected === kind);
}

export function sameMedia(a: MediaScope, b: MediaScope): boolean {
  return a.length === b.length && a.every((kind, index) => kind === b[index]);
}
