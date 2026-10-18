/* The Preview's keys (`36` section 8.1), pure: ArrowLeft and ArrowRight walk to the previous and the next channel, unless
 * the key belongs to something else: a text field or select (the caret and the options), the video's own controls
 * (seeking), a key already handled, a composition, or a chord. */

export interface WalkKey {
  readonly key: string;
  readonly defaultPrevented: boolean;
  readonly isComposing: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** The key came from a text field, a select or the video's controls. */
  readonly inField: boolean;
}

/** -1 for Previous, 1 for Next, null when the key is not the walk's. */
export function walkDirection(event: WalkKey): -1 | 1 | null {
  if (event.defaultPrevented || event.isComposing || event.inField) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.key === "ArrowLeft") return -1;
  return event.key === "ArrowRight" ? 1 : null;
}
