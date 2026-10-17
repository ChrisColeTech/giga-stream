/** The titlebar/statusbar tone (owner, 2026-10-17): Theatre mode paints both bars — background and
 *  border — black; the bars carry the CSS transition, so this is only the colour decision. */
export function barTone(theatre: boolean): string {
  return theatre ? "border-black bg-black" : "border-border bg-panel";
}
