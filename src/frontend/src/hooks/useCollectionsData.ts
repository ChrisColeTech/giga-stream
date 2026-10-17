import { useEffect } from "react";
import { listCollections } from "@/services/collections";
import { listJobs } from "@/services/jobs";
import { useAppStore } from "@/store/app-store";

const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not reach the fileserver.";

export async function refreshCollectionsData(): Promise<void> {
  const before = useAppStore.getState();
  const collectionsVersion = before.beginCollectionsRead();
  const jobsVersion = before.beginJobsRead();
  const [collections, jobs] = await Promise.allSettled([listCollections(), listJobs()]);
  const state = useAppStore.getState();
  if (collections.status === "fulfilled") state.acceptCollectionsRead(collectionsVersion, collections.value);
  if (jobs.status === "fulfilled") state.acceptJobsRead(jobsVersion, jobs.value);
  if (collections.status === "rejected") throw collections.reason;
  if (jobs.status === "rejected") throw jobs.reason;
}

export function useCollectionsData(): void {
  useEffect(() => {
    let current = true;
    void refreshCollectionsData().catch((error: unknown) => {
      if (current) useAppStore.getState().say(sentence(error), "warn");
    });
    return () => {
      current = false;
    };
  }, []);
}
