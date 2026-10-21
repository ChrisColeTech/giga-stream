export const LIBRARY_SECTION_KEYS = {
  categories: "library.categories",
  collections: "library.collections",
} as const;

type LibrarySectionKey = (typeof LIBRARY_SECTION_KEYS)[keyof typeof LIBRARY_SECTION_KEYS];

export function librarySectionState(
  folded: Readonly<Partial<Record<string, boolean>>>,
  key: LibrarySectionKey,
  toggleFold: (key: string) => void,
): { readonly open: boolean; readonly onToggle: () => void } {
  return { open: folded[key] !== true, onToggle: () => toggleFold(key) };
}
