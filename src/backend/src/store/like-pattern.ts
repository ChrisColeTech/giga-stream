/**
 * A case-insensitive "contains" pattern for `LIKE ? ESCAPE '\'`: the searched text's own `%`, `_` and `\` are matched
 * literally (docs/41 section 3.2). SQLite's LIKE folds ASCII case.
 */
export const containsPattern = (text: string): string => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const LIKE_ESCAPE = "ESCAPE '\\'";
