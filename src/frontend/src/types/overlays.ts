import type { ReactNode } from "react";

/** Every flow the one overlay host can open (`OverlayHost`). Opening a flow replaces the open one. A work surface is a
 *  modal child window drawn inside the main window; a popup hangs off an anchor and covers nothing. */
export type OverlayId = "settings" | "collections" | "title-info";

/** What a popup hangs from: the control that opened it, a point (a context-menu row), or nothing (the work area's one
 *  centred place). */
export type PopupAnchor = HTMLElement | { readonly x: number; readonly y: number } | null;

/** The three size classes of the authored popup standard: content width 242 / 460 / 602 points. */
export type PopupSize = "compact" | "standard" | "wide";

/** The three behaviour policies. Every authored popup declares exactly one; visual similarity never transfers
 *  behaviour from one to another.
 *  - draft: edits stay local; Cancel, Escape, X or an outside press discards; the primary action commits.
 *  - live: every change applies at once; closing never rolls back; no transaction footer.
 *  - operation: starts work that may outlive it; an outside press never closes it, and closing never cancels the work. */
export type PopupPolicy = "draft" | "live" | "operation";

export interface PopupProps {
  readonly anchor: PopupAnchor;
  readonly onClose: () => void;
}

export interface PopupPanelProps extends PopupProps {
  /** The title names the task or edited object, in Title Case; it never changes with a tab or ends in a colon. */
  readonly title: string;
  readonly size: PopupSize;
  readonly policy: PopupPolicy;
  /** The action footer, a Draft's or an Operation's. A Live popup has none. */
  readonly footer?: ReactNode;
  /** One cross-field or transaction refusal, shown immediately above the footer. */
  readonly status?: string | null;
  /** True for a node that belongs to the popup though it is rendered elsewhere (a select's menu portal). */
  readonly related?: (node: Node) => boolean;
  readonly children: ReactNode;
}
