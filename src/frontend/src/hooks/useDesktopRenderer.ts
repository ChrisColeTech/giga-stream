import { onDesktopRuntime } from "@/services/persistence";

/** The current renderer is desktop only when Electron's preload capability is installed. */
export function useDesktopRenderer(): boolean {
  return onDesktopRuntime();
}
