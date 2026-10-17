import type { Job } from "@/types/job";

/** PHASE 1 FIXTURE: the jobs the status bar shows; the one running scan is the "Films" folder the collections fixture
 *  marks as scanning (`03` section 3.9). */
export const JOBS: readonly Job[] = [
  { id: "j-scan-films", kind: "folder-scan", label: "Scanning Films", state: "running", percent: 40 },
];
