/** A job, as the fileserver reports it (`03` section 3.9). */
export interface Job {
  readonly id: string;
  readonly kind: "folder-scan" | "media-probe" | "poster-fetch";
  /** A short sentence ("Scanning Films"), never a path. */
  readonly label: string;
  readonly state: "queued" | "running" | "cancelling" | "done" | "failed" | "cancelled" | "interrupted";
  /** 0 to 100; absent while the work cannot say how far it is (a scan still walking its folder). */
  readonly percent?: number;
  readonly error?: { readonly code: string; readonly message: string };
  readonly createdAt: number;
  readonly startedAt?: number;
  readonly finishedAt?: number;
}

/** A job still going: queued, running or being cancelled. */
export function isLive(job: Job): boolean {
  return job.state === "queued" || job.state === "running" || job.state === "cancelling";
}
