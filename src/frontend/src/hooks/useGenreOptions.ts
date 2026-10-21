import { useEffect, useMemo, useState } from "react";
import { mergeGenreOptions, retainGenreFacets } from "@/lib/genre-options";

/** Stable Library genre choices: loading keeps the prior accepted vocabulary; an answer replaces it. */
export function useGenreOptions(
  facets: readonly string[] | null,
  selected: readonly string[],
): readonly string[] {
  const [accepted, setAccepted] = useState<readonly string[]>([]);
  useEffect(() => {
    if (facets !== null) setAccepted((current) => retainGenreFacets(current, facets));
  }, [facets]);
  const base = facets ?? accepted;
  return useMemo(() => mergeGenreOptions(base, selected), [base, selected]);
}
