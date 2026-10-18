import { useCallback, useReducer } from "react";
import {
  clearRefusals,
  discardForm,
  isDirty,
  refuseField,
  resetForm,
  setFields,
  startForm,
  type FormErrors,
  type FormState,
} from "@/lib/record-form";

/* THE SHARED FORM STATE of every tab's New form and workspace (`35` section 5.7). The signature is frozen after the
 * Accounts wave: the other tabs consume it unchanged. The logic is `lib/record-form.ts` (pure, tested); this file only
 * connects it to React. */

type Action<D> =
  | { readonly type: "set"; readonly patch: Partial<D> }
  | { readonly type: "discard" }
  | { readonly type: "reset"; readonly next: D }
  | { readonly type: "refuse"; readonly field: string; readonly sentence: string }
  | { readonly type: "clear" };

function reduce<D extends object>(state: FormState<D>, action: Action<D>): FormState<D> {
  switch (action.type) {
    case "set":
      return setFields(state, action.patch);
    case "discard":
      return discardForm(state);
    case "reset":
      return resetForm(state, action.next);
    case "refuse":
      return refuseField(state, action.field, action.sentence);
    case "clear":
      return clearRefusals(state);
  }
}

export interface RecordFormOptions<D> {
  /** The saved values (or empty ones for a New form): the first baseline. */
  readonly initial: D;
  /** Value equality of two drafts. */
  readonly same: (a: D, b: D) => boolean;
}

export interface RecordForm<D> {
  readonly draft: D;
  /** The fields that changed; a refusal under one of them is cleared. */
  readonly set: (patch: Partial<D>) => void;
  readonly dirty: boolean;
  /** Back to the baseline. */
  readonly discard: () => void;
  /** A saved record's draft becomes the baseline. */
  readonly reset: (next: D) => void;
  /** The refusal sentence under each row, by field name. */
  readonly errors: FormErrors;
  readonly setError: (field: string, sentence: string) => void;
  readonly clearErrors: () => void;
}

export function useRecordForm<D extends object>({ initial, same }: RecordFormOptions<D>): RecordForm<D> {
  const [state, dispatch] = useReducer(reduce<D>, initial, startForm);
  return {
    draft: state.draft,
    dirty: isDirty(state, same),
    errors: state.errors,
    set: useCallback((patch) => dispatch({ type: "set", patch }), []),
    discard: useCallback(() => dispatch({ type: "discard" }), []),
    reset: useCallback((next) => dispatch({ type: "reset", next }), []),
    setError: useCallback((field, sentence) => dispatch({ type: "refuse", field, sentence }), []),
    clearErrors: useCallback(() => dispatch({ type: "clear" }), []),
  };
}
