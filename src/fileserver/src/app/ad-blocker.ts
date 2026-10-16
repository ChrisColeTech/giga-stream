import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ElectronBlocker } from "@ghostery/adblocker-electron";
import { app, type Session } from "electron";

/** What the blocker reports for each request it refuses. */
export type BlockedReport = { host: string; type: string };

/**
 * Ghostery's ads-and-tracking lists (EasyList, EasyPrivacy), wired into the session's request layer the
 * way Giga Terminal does (its docs/07 section 1.5). The compiled engine is cached in userData: the first
 * launch downloads it once, later launches are offline-safe. A first launch with no network starts
 * unblocked rather than not at all, and says so; the host-resolver backstop (ad-hosts.ts) still applies.
 */
export async function enableAdBlocking(session: Session, onBlocked: (report: BlockedReport) => void): Promise<number> {
  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: path.join(app.getPath("userData"), "adblocker-engine.bin"),
      read: readFile,
      write: writeFile,
    });
    blocker.enableBlockingInSession(session);
    blocker.on("request-blocked", (request) => onBlocked({ host: request.hostname, type: request.type }));
    return blocker.getFilters().networkFilters.length;
  } catch (error) {
    console.error("[giga-stream] ad blocker failed to start; ad-named hosts are still refused", error);
    return 0;
  }
}
