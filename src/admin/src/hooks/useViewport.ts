import { useEffect, useState } from "react";
import type { Size } from "@/types/child-window";

/** The main window's inner size, kept current as it is resized. */
export function useViewport(): Size {
  const [size, setSize] = useState<Size>({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}
