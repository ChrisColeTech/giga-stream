import type { ComponentType } from "react";
import { IconButton } from "@giga/ui/controls/IconButton";

export interface CollectionIconActionProps {
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  /** The tooltip when it differs from the label, such as a two-step's armed consequence. */
  readonly title?: string;
  /** Why the action cannot run. Given, the action is disabled and the reason is its tooltip. */
  readonly reason?: string;
  readonly onPress?: () => void;
  readonly onBlur?: () => void;
}

/** A row's icon action (`06` section 2, rule 3). Disabled only with a reason; its tooltip is on the wrapper, because a
 *  disabled icon button takes no pointer. */
export function CollectionIconAction({ icon: Icon, label, title, reason, onPress, onBlur }: CollectionIconActionProps) {
  return (
    <span title={reason ?? title ?? label} className="inline-flex">
      <IconButton aria-label={label} disabled={reason !== undefined} onClick={onPress} onBlur={onBlur}>
        <Icon className="size-3.5" />
      </IconButton>
    </span>
  );
}
