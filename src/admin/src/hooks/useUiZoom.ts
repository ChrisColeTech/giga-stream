import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

/** UI zoom applies to the whole window: the document's own zoom, so every part of it scales together. */
export function useUiZoom(): void {
  const uiZoom = useAppStore((state) => state.uiZoom);
  useEffect(() => {
    document.documentElement.style.zoom = String(uiZoom);
  }, [uiZoom]);
}
