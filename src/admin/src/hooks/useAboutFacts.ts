import { FACT_UNKNOWN } from "@/constants/settings-sections";
import { hostAvailable } from "@/services/admin-host";

export interface AboutFacts {
  /** The address this page was loaded from, or a dash outside a browser. */
  readonly address: string;
  readonly runtime: "Electron" | "Browser";
}

/** The facts About reads from the device (the page's origin and whether the Electron bridge is there), so the component
 *  touches no window or bridge itself. A `window` without a `location` (a server render, a partial test shim) is outside
 *  a browser in every way that matters: the address is the dash. */
export function useAboutFacts(): AboutFacts {
  return {
    address: typeof window === "undefined" || window.location === undefined ? FACT_UNKNOWN : window.location.origin,
    runtime: hostAvailable() ? "Electron" : "Browser",
  };
}
