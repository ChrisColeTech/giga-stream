import { useEffect, useRef } from "react";
import { isTextField } from "@giga/ui/lib/text-field";
import { walkDirection } from "@/lib/preview-keys";

/** ArrowLeft and ArrowRight while the Preview is open walk the channels (`36` section 8.1), except in a text field or on
 *  the video's own controls. The window is modal, so no other surface hears these keys meanwhile. */
export function usePreviewKeys(step: (direction: -1 | 1) => void): void {
  const walk = useRef(step);
  walk.current = step;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      const inField = target !== null && (isTextField(target) || target.closest("video") !== null);
      const { key, defaultPrevented, isComposing, altKey, ctrlKey, metaKey, shiftKey } = event;
      const modifiers = { altKey, ctrlKey, metaKey, shiftKey };
      const direction = walkDirection({ key, defaultPrevented, isComposing, inField, ...modifiers });
      if (direction === null) return;
      event.preventDefault();
      walk.current(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
