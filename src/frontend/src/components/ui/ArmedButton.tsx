import type { ReactNode } from "react";
import { TWO_STEP_MS } from "@/constants/surfaces";
import { useArmedAction } from "@/hooks/useArmedAction";
import { Button, type ButtonSize } from "@giga/ui/controls/Button";

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
}

/** Giga Stream's one inline two-step (`01` section 9): ghost at rest, the first press turns it into the danger question,
 *  the second within TWO_STEP_MS confirms. Losing focus, Escape, or the timeout disarm it. No modal confirm. This
 *  replaces the family TwoStep, which had no blur or Escape disarm, and the hand-rolled copies beside it. */
export function ArmedButton({
  children,
  question,
  onConfirm,
  title,
  disabled = false,
  size = "sm",
  full = false,
}: ArmedButtonProps) {
  const { armed, arm, disarm } = useArmedAction(TWO_STEP_MS);
  return (
    <Button
      size={size}
      full={full}
      variant={armed ? "danger" : "ghost"}
      disabled={disabled}
      title={armed ? "Press again to confirm" : title}
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
