/** The rail's and the table's order: alphabetical by name, as `06` section 6.3 lists them. The input is not changed. */
export function alphabetical<T extends { readonly name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}
