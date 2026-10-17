/** Why a name cannot be sent, or nothing: a blank name has nothing to create, and a rename to the same name changes nothing. */
export type NameBlock = "blank" | "unchanged";

export function createBlock(draft: string): NameBlock | undefined {
  return draft.trim() === "" ? "blank" : undefined;
}

export function renameBlock(draft: string, current: string): NameBlock | undefined {
  const next = draft.trim();
  if (next === "") return "blank";
  return next === current.trim() ? "unchanged" : undefined;
}
