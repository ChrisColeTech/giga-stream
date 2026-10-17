import { ArrowUp } from "lucide-react";
import { IconButton } from "@giga/ui/controls/IconButton";
import { Tooltip } from "@giga/ui/form/Tooltip";

export const BACK_TO_TOP_LABEL = "Back to top";

/** The floating button itself, anchored to the bottom-right of its positioned parent (the Library centre). */
export function BackToTopButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <div className="absolute bottom-4 right-5 z-10">
      <Tooltip text={BACK_TO_TOP_LABEL}>
        <IconButton bordered aria-label={BACK_TO_TOP_LABEL} onClick={onClick}>
          <ArrowUp aria-hidden />
        </IconButton>
      </Tooltip>
    </div>
  );
}
