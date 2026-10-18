/** What one input event of the search field does, pure so a test can drive it. While an IME is composing, the field shows
 *  the draft and tells nobody (the half-typed syllable is not a query); `compositionend`, or any input that is not
 *  composing, commits the text. */
export interface SearchStep {
  /** The text the field shows while composing; null when the committed value is shown. */
  readonly draft: string | null;
  /** True when the text is committed: the parent is told, and the debounce restarts. */
  readonly commit: boolean;
}

export const inputStep = (composing: boolean, text: string): SearchStep =>
  composing ? { draft: text, commit: false } : { draft: null, commit: true };

export const compositionEndStep = (): SearchStep => ({ draft: null, commit: true });
