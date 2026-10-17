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
  scanProgress: Readonly<Record<string, ScanProgress>>;
  libraryCounts: ViewCounts;
  libraryQuery: LibraryQuery;
  library: LibraryPrefs;
  setCollections: (collections: z.infer<typeof CollectionListSchema>) => void;
  upsertCollection: (collection: z.infer<typeof CollectionSchema>) => void;
  removeCollectionState: (collectionId: string) => void;
  upsertFolder: (collectionId: string, folder: z.infer<typeof FolderSchema>) => void;
  removeFolderState: (folderId: string) => void;
  setJobs: (jobs: z.infer<typeof JobListSchema>) => void;
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
    setCollections: (collections) => set({ collections }),
    upsertCollection: (collection) => set({ collections: replaceById(get().collections, collection) }),
    removeCollectionState: (collectionId) =>
      set({ collections: get().collections.filter((collection) => collection.id !== collectionId) }),
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
      }),
    removeFolderState: (folderId) =>
      set({
        collections: get().collections.map((collection) => {
          const folders = collection.folders.filter((folder) => folder.id !== folderId);
          return folders.length === collection.folders.length
            ? collection
            : { ...collection, folders, scanning: folders.some((folder) => folder.scanning) };
        }),
      }),
    setJobs: (jobs) => set({ jobs }),
    upsertJob: (job) => set({ jobs: replaceById(get().jobs, job) }),
    removeJobState: (jobId) => set({ jobs: get().jobs.filter((job) => job.id !== jobId) }),
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
