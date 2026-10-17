export interface OverlayColors {
  readonly color: string;
  readonly symbolColor: string;
}

/** The two tones the native caption strip wears, from the token values. While the bars are idle the symbols take the
 *  strip's own colour, so the OS-painted buttons (which CSS cannot reach) disappear into the bar. */
export function overlayColors(tokens: { readonly panel: string; readonly faint: string }, idle: boolean): OverlayColors {
  return { color: tokens.panel, symbolColor: idle ? tokens.panel : tokens.faint };
}
