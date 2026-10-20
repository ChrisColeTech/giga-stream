import type { AdminDatabase } from "../store/admin-database.js";
import type { FolderScanner } from "./scan-service.js";

export interface ServiceOptions {
  dataDir: string;
  allowInsecureAdmin: boolean;
  defaultAdminUrl: string;
  now: () => number;
  adminDatabase?: AdminDatabase;
  tursoDatabaseUrl: string;
  tursoAuthToken: string;
  jwtSecret: string;
  adminFetch?: typeof fetch;
  imageFetch?: typeof fetch;
  scan?: FolderScanner;
  openFolderPicker?: () => Promise<{ path: string } | "cancelled">;
  testFolderRoot?: string;
}
