/** The tooltip an armed two-step wears while it waits for its second press. */
export const ARMED_TITLE = "Press again to confirm";

export interface ArmedFace {
  readonly variant: "ghost" | "danger";
  readonly title: string | undefined;
}

/** The look of an inline two-step (`01` section 9): ghost at rest with the caller's tooltip, danger while armed with the
 *  press-again tooltip. Pure, so the armed look is tested without pressing anything. */
export function armedFace(armed: boolean, rest: string | undefined): ArmedFace {
  return armed ? { variant: "danger", title: ARMED_TITLE } : { variant: "ghost", title: rest };
}
