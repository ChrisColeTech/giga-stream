import type { Job } from "@/types/job";

/** PHASE 1 FIXTURE: retained until the phase 2.7 fixture cleanup; wired surfaces read the jobs store instead. */
export const JOBS: readonly Job[] = [
  {
    id: "j-scan-films",
    kind: "folder-scan",
    folderId: "f-films",
    label: "Scanning Films",
    state: "running",
    percent: 40,
    createdAt: 1790000000000,
  },
];
