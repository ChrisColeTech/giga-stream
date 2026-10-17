import { hostOf } from "@/lib/event-host";
import type { EventInput } from "@/lib/event-log";
import { useAppStore } from "@/store/app-store";

/** One report of the Electron shell's guard (`03` section 5): kind names the refusal, url/origin name the site, and
 *  no field ever carries a path that reaches a sentence. */
export interface GuardReport {
  readonly kind: string;
  readonly url?: string;
  readonly permission?: string;
  readonly origin?: string;
  readonly blocked?: boolean;
}

const BROWSER_NOTE_ID = "guard-browser-note";
const BROWSER_NOTE = "The desktop shell guards are absent in a browser.";
const REFUSED = new Set(["popup", "navigate"]);

/** The refused sentence of a kind, in the drawer's host-only wording; an unparseable address is simply left out. */
function sentenceOf(report: GuardReport, host: string | null): string {
  const hosted = (sentence: string): string => (host === null ? `${sentence}.` : `${sentence} (${host}).`);
  switch (report.kind) {
    case "popup":
      return hosted(report.blocked === true ? "A popup was refused" : "A popup was observed");
    case "navigate":
      return hosted(report.blocked === true ? "A top-level navigation was refused" : "A top-level navigation was observed");
    case "frame navigate":
      return hosted("A frame navigation was observed");
    case "player hijack":
      return hosted("A player hijack was refused");
    case "permission":
      return hosted(`The frame asked for ${report.permission ?? "a permission"}`);
    case "ad blocked":
      return hosted("An ad was blocked");
    default:
      return hosted("The desktop shell reported a refusal");
  }
}

/** One row per report: the frame's kinds stay Connection traffic, blocked ads are Provider news, and a hijack or a
 *  refused navigation or popup is a warning. */
export function guardEvent(report: GuardReport): EventInput {
  const host = hostOf(report.url ?? report.origin ?? "");
  const isAd = report.kind === "ad blocked";
  return {
    tone: report.kind === "player hijack" || (REFUSED.has(report.kind) && report.blocked === true) ? "warn" : "info",
    area: isAd ? "Provider" : "Connection",
    sentence: sentenceOf(report, host),
    ...(report.kind === "permission" && report.permission !== undefined ? { identity: report.permission } : {}),
    ...(isAd && host !== null ? { identity: host } : {}),
  };
}

let subscribed = false;
let noteGiven = false;

/** Subscribes once to the desktop shell's onGuard reports and feeds each one to the events drawer. In a browser the
 *  installer is a no-op that logs the absent-guards note exactly once; the returned function ends the subscription.
 *  Frame-guard refusals and dialog no-ops are decided in the Electron main process and arrive here as reports already,
 *  so the frontend never re-reports them. */
export function installGuardEvents(): () => void {
  const host = typeof window === "undefined" ? undefined : window.pocHost;
  if (host?.runtime !== "electron" || typeof host.onGuard !== "function") {
    if (!noteGiven) {
      noteGiven = true;
      useAppStore.getState().logEvent({
        id: BROWSER_NOTE_ID,
        tone: "info",
        area: "Connection",
        sentence: BROWSER_NOTE,
      });
    }
    return () => undefined;
  }
  if (subscribed) return () => undefined;
  subscribed = true;
  host.onGuard((report) => {
    if (typeof report === "object" && report !== null && "kind" in report) {
      useAppStore.getState().logEvent(guardEvent(report as GuardReport));
    }
  });
  return () => {
    subscribed = false;
  };
}
