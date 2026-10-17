import { app } from "electron";

/** The admin's Vite dev server (src/admin/vite.config.mts), loaded unpackaged when it answers. */
const DEV_URL = "http://127.0.0.1:5172/admin/";
const DEV_WAIT_MS = 3000;
/** `--wait-vite` (the dev stack starts Vite and this window together): give Vite time to come up before falling back. */
const STACK_WAIT_MS = 30_000;
const WAIT_FOR_VITE = process.argv.includes("--wait-vite");
const ADMIN_PATH = "/admin/";
const PROBE_TIMEOUT_MS = 1500;
const PROBE_RETRY_MS = 250;

/** Whether anything answers at the address: any response counts, only a transport failure is a no. */
async function answers(url: string, waitMs: number): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, PROBE_RETRY_MS));
    }
  }
  return false;
}

/** The page the window loads: the Vite server when unpackaged and it answers (edits reload in place), else the
 *  backend's own `/admin/`, which must exist: a missing build is a message, not a window of JSON. */
export async function resolveAppUrl(origin: string): Promise<string> {
  if (!app.isPackaged && (await answers(DEV_URL, WAIT_FOR_VITE ? STACK_WAIT_MS : DEV_WAIT_MS))) return DEV_URL;
  const own = `${origin}${ADMIN_PATH}`;
  const reply = await fetch(own, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }).catch(() => null);
  if (reply?.ok !== true) throw new Error("The admin app is not built. Run: npm run build --prefix src/admin");
  return own;
}
