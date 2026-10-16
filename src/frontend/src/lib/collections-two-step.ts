/** How long an armed Remove collection waits for its second press before it disarms by itself. */
export const ARM_TIMEOUT_MS = 5000;

export type TwoStepPhase = "idle" | "armed";

/** What reaches the control: a press, or one of the three ways out of the armed state. */
export type TwoStepEvent = "press" | "timeout" | "blur" | "escape";

/** The inline two-step (`06` section 2, rule 9; `04` section 5). A press arms an idle control. A press while armed
 *  would confirm the removal, which phase 1 cannot do, so it stays armed. A timeout, focus leaving or Escape disarms.
 */
export function nextTwoStep(event: TwoStepEvent): TwoStepPhase {
  return event === "press" ? "armed" : "idle";
}
