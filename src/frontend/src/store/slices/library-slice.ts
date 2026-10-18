import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { createItemMemory } from "@/store/library-item-memory";
import { DEFAULT_QUERY, type LibraryQuery, type ViewCounts } from "@/lib/library-query";
import type { CollectionListSchema, CollectionSchema, FolderSchema } from "@/services/schemas/collection-schema";
import type { JobListSchema, JobSchema } from "@/services/schemas/job-schema";
import type { z } from "zod";
import type { ScanProgress } from "@/types/collection";
import type { LibraryPrefs } from "@/types/settings";
import type { LibraryItem, Membership, MembershipSource } from "@/types/library";

const EMPTY_COUNTS: ViewCounts = { collections: {} };

export interface LibrarySlice {
  collections: z.infer<typeof CollectionListSchema>;
  jobs: z.infer<typeof JobListSchema>;
  collectionsVersion: number;
  jobsVersion: number;
  scanProgress: Readonly<Record<string, ScanProgress>>;
  libraryCounts: ViewCounts;
  libraryQuery: LibraryQuery;
  libraryItems: readonly LibraryItem[];
  libraryRefreshSerial: number;
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
  rememberLibraryItems: (items: readonly LibraryItem[]) => void;
  requestLibraryRefresh: () => void;
  setLibraryPrefs: (change: Partial<LibraryPrefs>) => void;
  setFavourite: (key: string, favourite: boolean) => void;
  setMembership: (key: string, collectionId: string, member: boolean, source?: MembershipSource) => void;
  setMemberships: (key: string, memberships: readonly Membership[]) => void;
  marks: {
    readonly favourites: Readonly<Record<string, boolean>>;
    readonly memberships: Readonly<Record<string, readonly string[]>>;
    readonly membershipSources: Readonly<Record<string, Readonly<Record<string, MembershipSource>>>>;
  };
}

interface Host extends LibrarySlice {
  settingsRevision: number;
}

type Set = (partial: Partial<Host>) => void;
type Get = () => Host;

export function librarySlice(set: Set, get: Get): LibrarySlice {
  const remember = createItemMemory();
  return {
    collections: [],
    jobs: [],
    collectionsVersion: 0,
    jobsVersion: 0,
    scanProgress: {},
    libraryCounts: EMPTY_COUNTS,
    libraryQuery: { ...DEFAULT_QUERY },
    libraryItems: [],
    libraryRefreshSerial: 0,
    library: {
      libraryView: DEFAULT_SETTINGS.libraryView,
      librarySort: DEFAULT_SETTINGS.librarySort,
      showContinue: DEFAULT_SETTINGS.showContinue,
      pauseHistory: DEFAULT_SETTINGS.pauseHistory,
      rescanOnStartup: DEFAULT_SETTINGS.rescanOnStartup,
      libraryScope: DEFAULT_SETTINGS.libraryScope,
      librarySource: DEFAULT_SETTINGS.librarySource,
      libraryGenres: DEFAULT_SETTINGS.libraryGenres,
      libraryYear: DEFAULT_SETTINGS.libraryYear,
      libraryWatched: DEFAULT_SETTINGS.libraryWatched,
      libraryFilter: DEFAULT_SETTINGS.libraryFilter,
    },
    setCollections: (collections) => set({ collections, collectionsVersion: get().collectionsVersion + 1 }),
    beginCollectionsRead: () => {
      const version = get().collectionsVersion + 1;
      set({ collectionsVersion: version });
      return version;
    },
    acceptCollectionsRead: (version, collections) => {
      if (version !== get().collectionsVersion) return false;
      set({ collections });
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
        ...(folder.scanning ? { scanProgress: withoutKey(get().scanProgress, folder.id) } : {}),
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
    beginJobsRead: () => {
      const version = get().jobsVersion + 1;
      set({ jobsVersion: version });
      return version;
    },
    acceptJobsRead: (version, jobs) => {
      if (version !== get().jobsVersion) return false;
      set({ jobs });
      return true;
    },
    upsertJob: (job) => set({ jobs: replaceById(get().jobs, job), jobsVersion: get().jobsVersion + 1 }),
    removeJobState: (jobId) =>
      set({ jobs: get().jobs.filter((job) => job.id !== jobId), jobsVersion: get().jobsVersion + 1 }),
    setScanProgress: (folderId, progress) =>
      set({ scanProgress: { ...get().scanProgress, [folderId]: progress } }),
    setLibraryCounts: (libraryCounts) => set({ libraryCounts }),
    setLibraryQuery: (change) => set({ libraryQuery: { ...get().libraryQuery, ...change } }),
    rememberLibraryItems: (items) => set({ libraryItems: remember(get().libraryItems, items) }),
    requestLibraryRefresh: () => set({ libraryRefreshSerial: get().libraryRefreshSerial + 1 }),
    setLibraryPrefs: (change) =>
      set({ library: { ...get().library, ...change }, settingsRevision: get().settingsRevision + 1 }),
    marks: { favourites: {}, memberships: {}, membershipSources: {} },
    setFavourite: (key, favourite) => {
      const marks = get().marks;
      set({ marks: { ...marks, favourites: { ...marks.favourites, [key]: favourite } } });
    },
    setMembership: (key, collectionId, member, source = "manual") => {
      const marks = get().marks;
      const current = marks.memberships[key] ?? [];
      const next = member
        ? [...current.filter((id) => id !== collectionId), collectionId]
        : current.filter((id) => id !== collectionId);
      const sources = { ...marks.membershipSources[key] };
      if (member) sources[collectionId] = source;
      else delete sources[collectionId];
      set({ marks: {
        ...marks,
        memberships: { ...marks.memberships, [key]: next },
        membershipSources: { ...marks.membershipSources, [key]: sources },
      } });
    },
    setMemberships: (key, memberships) => {
      const marks = get().marks;
      const sources = Object.fromEntries(memberships.map((row) => [row.collectionId, row.source]));
      set({ marks: {
        ...marks,
        memberships: { ...marks.memberships, [key]: memberships.map((row) => row.collectionId) },
        membershipSources: { ...marks.membershipSources, [key]: sources },
      } });
    },
  };
}

function replaceById<T extends { readonly id: string }>(rows: readonly T[], next: T): T[] {
  const found = rows.some((row) => row.id === next.id);
  return found ? rows.map((row) => (row.id === next.id ? next : row)) : [...rows, next];
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
