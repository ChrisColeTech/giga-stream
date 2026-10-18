const NUMERIC_TOKEN = /^\d+$/;

/**
 * A title's genres as names (docs/46 section C): a stored list row carries TMDB's genre ids as strings, an edited
 * or detail row carries names. Each token is `byId.get(token) ?? token`; a numeric token the dictionary does not
 * know is dropped, because an id is no name to show. Duplicates collapse, order is kept.
 */
export function decodeGenres(tokens: readonly string[], byId: ReadonlyMap<string, string>): string[] {
  const names: string[] = [];
  for (const token of tokens) {
    const known = byId.get(token);
    if (known === undefined && (NUMERIC_TOKEN.test(token) || token === "")) continue;
    const name = known ?? token;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}
