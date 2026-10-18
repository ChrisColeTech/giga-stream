/** Is this chip one of the last `min` that are on? Such a chip cannot be switched off (`ChipGroup`'s `min` rule): with
 *  three qualities and `min` 2, the third can go; with two, both stay. A chip that is off is never locked. */
export function lockedByMin(on: boolean, selectedCount: number, min: number): boolean {
  return on && selectedCount <= min;
}

/** The reason a locked chip gives (its title): the rule in a sentence. */
export function minReason(min: number): string {
  return `At least ${min} must stay on.`;
}
