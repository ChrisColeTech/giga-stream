import type { ComponentType } from "react";
import { IconButton } from "@/components/ui/IconButton";

export interface CollectionIconActionProps {
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  /** Why the action cannot run. It is the tooltip of the wrapper, because a disabled icon button takes no pointer. */
  readonly reason: string;
}

/** A row's icon action, drawn disabled with its reason (`06` section 2, rule 3). Phase 1 has nothing for it to do. */
export function CollectionIconAction({ icon: Icon, label, reason }: CollectionIconActionProps) {
  return (
    <span title={reason} className="inline-flex">
      <IconButton aria-label={label} disabled>
        <Icon className="size-3.5" />
      </IconButton>
    </span>
  );
}
