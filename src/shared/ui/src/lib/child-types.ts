/** What Escape does in a child window. A text field or an open menu has the key first, whatever the policy.
 *  - never: a tool stays up beside the main window.
 *  - always: dismisses the window unless a menu was open (a popup's rule).
 *  - unless-typing: dismisses the window unless a menu was open or a field is being typed in (a work surface's rule:
 *    the first Escape belongs to the field). */
export type ChildEscape = "never" | "always" | "unless-typing";

/** Where a window is put the first time it opens: centred on the main window (a surface that is the task at hand), or
 *  beside its corner (a tool left up while the main window is used). */
export type ChildPlace = "centre" | "corner";

/** What a child window is: its key (one window each), its title, the content width and the body height under the
 *  header, and the least content it can be made (nothing in it is clipped at that size; the body scrolls). */
export interface ChildSpec {
  readonly key: string;
  readonly title: string;
  readonly width: number;
  readonly body: number;
  readonly minWidth: number;
  readonly minBody: number;
  /** The main window ignores everything while it is open: a scrim covers it and no key reaches it. */
  readonly modal: boolean;
  readonly place: ChildPlace;
  readonly escape: ChildEscape;
  /** The header's Maximize button and the double-click on the header; default true, `false` opts the window out. */
  readonly maximizable?: boolean;
}

/** A rectangle in window pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The sizes a window may take: the one it opens at, the least and the most. */
export interface ChildLimits {
  readonly open: Size;
  readonly min: Size;
  readonly max: Size;
}
