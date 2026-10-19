import type { ChoicePopoverOption } from '../types/choice-popover'

export const CHOICE_SEARCH_THRESHOLD = 12
export const CHOICE_TAB_STOPS =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),' +
  '[tabindex]:not([tabindex="-1"])'

export function choicePopoverSearches(optionCount: number, threshold = CHOICE_SEARCH_THRESHOLD): boolean {
  return optionCount >= threshold
}

export function filterChoiceOptions<T extends string>(
  options: readonly ChoicePopoverOption<T>[],
  text: string,
): readonly ChoicePopoverOption<T>[] {
  const query = text.trim().toLocaleLowerCase()
  return query === '' ? options : options.filter((option) => option.label.toLocaleLowerCase().includes(query))
}

export function isCompleteChoiceSet<T extends string>(values: readonly T[], complete: readonly T[]): boolean {
  return values.length === complete.length && complete.every((value) => values.includes(value))
}

/** All is represented by its canonical specific values. From All, choosing one specific starts a singleton; removing
 * the last specific restores All, and reaching the complete set returns it in canonical order. */
export function nextChoiceValues<T extends string>(
  values: readonly T[],
  value: T,
  canonical: readonly T[],
  complete?: readonly T[],
): readonly T[] {
  if (complete !== undefined && isCompleteChoiceSet(values, complete)) return [value]
  const selected = new Set(values)
  if (selected.has(value)) selected.delete(value)
  else selected.add(value)
  if (complete !== undefined && selected.size === 0) return complete
  const next = canonical.filter((item) => selected.has(item))
  return complete !== undefined && isCompleteChoiceSet(next, complete) ? complete : next
}
