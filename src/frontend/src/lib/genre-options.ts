/** Keep the last accepted facets while the next page is absent; an accepted empty list replaces them. */
export function retainGenreFacets(
  current: readonly string[],
  accepted: readonly string[] | null,
): readonly string[] {
  if (accepted === null) return current;
  if (accepted.length === current.length && accepted.every((genre, index) => genre === current[index])) return current;
  return accepted;
}

/** Accepted facet order is authoritative; selected values missing from it remain representable at the end. */
export function mergeGenreOptions(
  accepted: readonly string[],
  selected: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const genre of [...accepted, ...selected]) {
    if (seen.has(genre)) continue;
    seen.add(genre);
    merged.push(genre);
  }
  const unchanged = merged.length === accepted.length && merged.every((genre, index) => genre === accepted[index]);
  return unchanged ? accepted : merged;
}
