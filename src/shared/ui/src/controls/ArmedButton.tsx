import type { ReactNode } from "react";
import { useArmedAction } from "../hooks/useArmedAction";
import { TWO_STEP_MS } from "../lib/motion-timing";
import { Button, type ButtonSize } from "./Button";
import { armedFace } from "./armed-face";

export interface ArmedButtonProps {
  readonly children: ReactNode;
  /** What the button says once armed: a question naming what dies ("Delete Films?"). */
  readonly question: string;
  readonly onConfirm: () => void;
  /** The tooltip at rest; when disabled, the reason. */
  readonly title?: string;
  readonly disabled?: boolean;
  readonly size?: ButtonSize;
  readonly full?: boolean;
  /** How long the second press has to come; the family's value unless a caller gives its own. */
  readonly timeoutMs?: number;
}

/** The one inline two-step (`01` section 9): ghost at rest, the first press turns it into the danger question, the second
 *  within the timeout confirms. Losing focus, Escape, or the timeout disarm it. No modal confirm. This replaces the family
 *  TwoStep, which had no blur or Escape disarm, and the hand-rolled copies beside it. */
export function ArmedButton({
  children,
  question,
  onConfirm,
  title,
  disabled = false,
  size = "sm",
  full = false,
  timeoutMs = TWO_STEP_MS,
}: ArmedButtonProps) {
  const { armed, arm, disarm } = useArmedAction(timeoutMs);
  const face = armedFace(armed, title);
  return (
    <Button
      size={size}
      full={full}
      variant={face.variant}
      disabled={disabled}
      title={face.title}
      onBlur={disarm}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !armed) return;
        event.stopPropagation();
        disarm();
      }}
      onClick={() => {
        if (!armed) {
          arm();
          return;
        }
        disarm();
        onConfirm();
      }}
    >
      {armed ? question : children}
    </Button>
  );
}
