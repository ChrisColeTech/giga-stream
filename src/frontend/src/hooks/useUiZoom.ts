import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

/** Applies the saved zoom to the one document root. */
export function useUiZoom(): void {
  const uiZoom = useAppStore((state) => state.uiZoom);
  useEffect(() => {
    document.documentElement.style.zoom = String(uiZoom);
  }, [uiZoom]);
}
