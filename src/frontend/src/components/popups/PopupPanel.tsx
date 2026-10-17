import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui/IconButton";
import { POPUP_BORDER, POPUP_CLASSES, POPUP_PAD } from "@/constants/popups";
import { usePopupFrame } from "@/hooks/usePopupFrame";
import type { PopupPanelProps } from "@/types/overlays";

/* THE ONE SCAFFOLD. Every authored popup is assembled here, in this order: the title header, the body, a conditional
 * status row, the action footer. The scaffold owns the frame, border, radius, shadow, title, separators, padding, size
 * class, body scrolling, placement, dismissal and focus; a feature supplies content, one size class, one behaviour
 * policy and its action labels. A feature never paints its own frame, title bar or footer.
 *
 * Height is intrinsic until the body reaches its class cap, then only the body scrolls. The title, status and footer
 * never scroll. Width and anchor are fixed for one opening. Every title header carries the close X, named
 * `Close <title>`, and it behaves exactly like the policy's other dismissal paths: it never commits. */
export function PopupPanel({ title, size, policy, anchor, onClose, footer, status, related, children }: PopupPanelProps) {
  const panel = usePopupFrame(anchor, policy, onClose, related);
  const { width, body } = POPUP_CLASSES[size];

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={title}
      data-popup={size}
      data-policy={policy}
      style={{ width: width + 2 * (POPUP_PAD + POPUP_BORDER) }}
      className="fixed z-60 flex flex-col overflow-hidden rounded-card border border-border bg-panel font-sans shadow-menu"
    >
      <div className="flex h-7 flex-none items-center gap-2 border-b border-hair pr-1 pl-2">
        <h2 className="m-0 min-w-0 flex-1 truncate font-sans text-xs font-semibold text-text">{title}</h2>
        <IconButton className="size-5.5" title={`Close ${title}`} aria-label={`Close ${title}`} onClick={onClose}>
          <X className="size-3.25" aria-hidden />
        </IconButton>
      </div>
      <div className="min-h-0 overflow-y-auto p-2" style={{ maxHeight: body }}>
        {children}
      </div>
      {status != null && status !== "" && (
        <p role="alert" className="m-0 flex-none border-t border-hair px-2 py-1.5 text-xs leading-snug text-st-failed">
          {status}
        </p>
      )}
      {footer !== undefined && (
        <div className="flex h-9 flex-none items-center justify-end gap-2 border-t border-hair px-2">{footer}</div>
      )}
    </div>,
    document.body,
  );
}
