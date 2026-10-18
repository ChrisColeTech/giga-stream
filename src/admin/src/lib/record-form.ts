/* The pure core of `hooks/useRecordForm.ts`: a form's draft against its saved baseline, and the refusals shown under
 * its rows. `dirty` is a fact about values (`!same(draft, baseline)`), never a flag set by typing, so typing a value
 * back is clean again. Every function returns a new state. */

export type FormErrors = Readonly<Record<string, string>>;

export interface FormState<D> {
  readonly baseline: D;
  readonly draft: D;
  readonly errors: FormErrors;
}

export const startForm = <D>(initial: D): FormState<D> => ({ baseline: initial, draft: initial, errors: {} });

const without = (errors: FormErrors, fields: readonly string[]): FormErrors =>
  Object.fromEntries(Object.entries(errors).filter(([field]) => !fields.includes(field)));

/** Typing: the changed fields take their values, and a refusal under a field the person is editing goes away. */
export function setFields<D extends object>(state: FormState<D>, patch: Partial<D>): FormState<D> {
  return { ...state, draft: { ...state.draft, ...patch }, errors: without(state.errors, Object.keys(patch)) };
}

/** Discard changes: the draft returns to the baseline and every refusal is cleared. */
export const discardForm = <D>(state: FormState<D>): FormState<D> => startForm(state.baseline);

/** A saved record's draft becomes the new baseline (and the draft). */
export const resetForm = <D>(_state: FormState<D>, next: D): FormState<D> => startForm(next);

export function refuseField<D>(state: FormState<D>, field: string, sentence: string): FormState<D> {
  return { ...state, errors: { ...state.errors, [field]: sentence } };
}

export const clearRefusals = <D>(state: FormState<D>): FormState<D> => ({ ...state, errors: {} });

export const isDirty = <D>(state: FormState<D>, same: (a: D, b: D) => boolean): boolean =>
  !same(state.draft, state.baseline);
