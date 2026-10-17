import { useEffect, useState, type RefObject } from "react";
import { backToTopVisible } from "@/lib/back-to-top";

/** Whether a Library scroller is scrolled far enough to offer Back to top. Driven by the scroller's own scroll event
 *  (passive, as the scroll-spy is), never a timer. */
export function useBackToTop(scroller: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const box = scroller.current;
    if (box === null) return;
    const onScroll = (): void => setVisible(backToTopVisible(box.scrollTop, box.clientHeight));
    box.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => box.removeEventListener("scroll", onScroll);
  }, [scroller]);
  return visible;
}
