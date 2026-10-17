import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { DEFAULT_QUERY, type LibraryQuery, type ViewCounts } from "@/lib/library-query";
import type { CollectionListSchema, CollectionSchema, FolderSchema } from "@/services/schemas/collection-schema";
import type { JobListSchema, JobSchema } from "@/services/schemas/job-schema";
import type { z } from "zod";
import type { ScanProgress } from "@/types/collection";
import type { LibraryPrefs } from "@/types/settings";

const EMPTY_COUNTS: ViewCounts = { all: 0, history: 0, favorites: 0, collections: {} };

export interface LibrarySlice {
  collections: z.infer<typeof CollectionListSchema>;
  jobs: z.infer<typeof JobListSchema>;
  collectionsVersion: number;
  jobsVersion: number;
  scanProgress: Readonly<Record<string, ScanProgress>>;
  libraryCounts: ViewCounts;
  libraryQuery: LibraryQuery;
  library: LibraryPrefs;
  setCollections: (collections: z.infer<typeof CollectionListSchema>) => void;
  beginCollectionsRead: () => number;
  acceptCollectionsRead: (version: number, collections: z.infer<typeof CollectionListSchema>) => boolean;
  upsertCollection: (collection: z.infer<typeof CollectionSchema>) => void;
  removeCollectionState: (collectionId: string) => void;
  upsertFolder: (collectionId: string, folder: z.infer<typeof FolderSchema>) => void;
  removeFolderState: (folderId: string) => void;
  setJobs: (jobs: z.infer<typeof JobListSchema>) => void;
  beginJobsRead: () => number;
  acceptJobsRead: (version: number, jobs: z.infer<typeof JobListSchema>) => boolean;
  upsertJob: (job: z.infer<typeof JobSchema>) => void;
  removeJobState: (jobId: string) => void;
  setScanProgress: (folderId: string, progress: ScanProgress) => void;
  setLibraryCounts: (counts: ViewCounts) => void;
  setLibraryQuery: (change: Partial<LibraryQuery>) => void;
  setLibraryPrefs: (change: Partial<LibraryPrefs>) => void;
  setFavourite: (key: string, favourite: boolean) => void;
  setMembership: (key: string, collectionId: string, member: boolean) => void;
  marks: {
    readonly favourites: Readonly<Record<string, boolean>>;
    readonly memberships: Readonly<Record<string, readonly string[]>>;
  };
}

interface Host extends LibrarySlice {
  settingsRevision: number;
}

type Set = (partial: Partial<Host>) => void;
type Get = () => Host;

export function librarySlice(set: Set, get: Get): LibrarySlice {
  return {
    collections: [],
    jobs: [],
    collectionsVersion: 0,
    jobsVersion: 0,
    scanProgress: {},
    libraryCounts: EMPTY_COUNTS,
    libraryQuery: { ...DEFAULT_QUERY },
    library: {
      libraryView: DEFAULT_SETTINGS.libraryView,
      librarySort: DEFAULT_SETTINGS.librarySort,
      showContinue: DEFAULT_SETTINGS.showContinue,
      pauseHistory: DEFAULT_SETTINGS.pauseHistory,
      rescanOnStartup: DEFAULT_SETTINGS.rescanOnStartup,
    },
    setCollections: (collections) => set({ collections, collectionsVersion: get().collectionsVersion + 1 }),
    beginCollectionsRead: () => get().collectionsVersion,
    acceptCollectionsRead: (version, collections) => {
      if (version !== get().collectionsVersion) return false;
      set({ collections, collectionsVersion: version + 1 });
      return true;
    },
    upsertCollection: (collection) =>
      set({ collections: replaceById(get().collections, collection), collectionsVersion: get().collectionsVersion + 1 }),
    removeCollectionState: (collectionId) =>
      set({
        collections: get().collections.filter((collection) => collection.id !== collectionId),
        collectionsVersion: get().collectionsVersion + 1,
      }),
    upsertFolder: (collectionId, folder) =>
      set({
        collections: get().collections.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                folders: replaceById(collection.folders, folder),
                scanning: collection.folders.some((item) => item.id !== folder.id && item.scanning) || folder.scanning,
              }
            : collection,
        ),
        collectionsVersion: get().collectionsVersion + 1,
      }),
    removeFolderState: (folderId) =>
      set({
        collections: get().collections.map((collection) => {
          const folders = collection.folders.filter((folder) => folder.id !== folderId);
          return folders.length === collection.folders.length
            ? collection
            : { ...collection, folders, scanning: folders.some((folder) => folder.scanning) };
        }),
        collectionsVersion: get().collectionsVersion + 1,
      }),
    setJobs: (jobs) => set({ jobs, jobsVersion: get().jobsVersion + 1 }),
    beginJobsRead: () => get().jobsVersion,
    acceptJobsRead: (version, jobs) => {
      if (version !== get().jobsVersion) return false;
      set({ jobs, jobsVersion: version + 1 });
      return true;
    },
    upsertJob: (job) => set({ jobs: replaceById(get().jobs, job), jobsVersion: get().jobsVersion + 1 }),
    removeJobState: (jobId) =>
      set({ jobs: get().jobs.filter((job) => job.id !== jobId), jobsVersion: get().jobsVersion + 1 }),
    setScanProgress: (folderId, progress) =>
      set({ scanProgress: { ...get().scanProgress, [folderId]: progress } }),
    setLibraryCounts: (libraryCounts) => set({ libraryCounts }),
    setLibraryQuery: (change) => set({ libraryQuery: { ...get().libraryQuery, ...change } }),
    setLibraryPrefs: (change) =>
      set({ library: { ...get().library, ...change }, settingsRevision: get().settingsRevision + 1 }),
    marks: { favourites: {}, memberships: {} },
    setFavourite: (key, favourite) => {
      const marks = get().marks;
      set({ marks: { ...marks, favourites: { ...marks.favourites, [key]: favourite } } });
    },
    setMembership: (key, collectionId, member) => {
      const marks = get().marks;
      const current = marks.memberships[key] ?? [];
      const next = member
        ? [...current.filter((id) => id !== collectionId), collectionId]
        : current.filter((id) => id !== collectionId);
      set({ marks: { ...marks, memberships: { ...marks.memberships, [key]: next } } });
    },
  };
}

function replaceById<T extends { readonly id: string }>(rows: readonly T[], next: T): T[] {
  const found = rows.some((row) => row.id === next.id);
  return found ? rows.map((row) => (row.id === next.id ? next : row)) : [...rows, next];
}
