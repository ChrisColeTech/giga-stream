import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { isTextField } from "@/lib/text-field";
import type { ChildEscape } from "@/types/child-window";

/** The keyboard of a child window. A modal window makes the main window deaf: any key typed outside it is swallowed in
 *  the capture phase, before a shortcut can hear it, which is the in-app equivalent of a second OS window owning the
 *  keyboard. Escape dismisses the window by its policy, heard in the bubble phase so the deepest layer has it first: a
 *  field, an open menu or an IME that handled the key has marked it, and a work surface's first Escape belongs to a
 *  text field. The window takes the keyboard when it opens and gives it back to what had it when it closes. */
export function useChildWindowKeys(
  frame: RefObject<HTMLElement | null>,
  { escape, modal, onClose }: { escape: ChildEscape; modal: boolean; onClose: () => void },
): void {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    frame.current?.focus({ preventScroll: true });
    return () => {
      if (opener !== null && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [frame]);

  useEffect(() => {
    const deaf = (event: KeyboardEvent): void => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && frame.current?.contains(target) === true) return;
      /* A Radix menu (the Collections submenu) renders in a portal on the body, outside the frame, but it is this
       * window's own control: its keys reach it, and Radix's own Escape handling runs on them. */
      if (target instanceof Element && target.closest('[role="menu"]') !== null) return;
      event.stopPropagation();
      event.preventDefault();
    };
    if (modal) window.addEventListener("keydown", deaf, true);
    return () => window.removeEventListener("keydown", deaf, true);
  }, [modal, frame]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || escape === "never" || event.defaultPrevented || event.isComposing) return;
      if (document.querySelector(".menu-panel:not([hidden])") !== null) return;
      const target = event.target instanceof Element ? event.target : null;
      if (escape === "unless-typing" && target !== null && isTextField(target)) return;
      event.preventDefault();
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape]);
}
