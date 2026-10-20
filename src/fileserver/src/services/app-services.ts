import path from "node:path";

import { APP_ROLE, APP_RUNTIME, APP_VERSION } from "../constants/deployment.js";
import { createAdminChannelRepository } from "../store/admin-channel-repository.js";
import { createAdminTitleRepository } from "../store/admin-title-repository.js";
import { openAdminDatabase, validateAdminSchema, type AdminDatabase } from "../store/admin-database.js";
import { openDatabase, pingDatabase, type Database } from "../store/database.js";
import { createChannelStateRepository } from "../store/channel-state-repository.js";
import { createCollectionRepository } from "../store/collection-repository.js";
import { createFavoritesRepository } from "../store/favorites-repository.js";
import { createJobRepository } from "../store/job-repository.js";
import { createLibraryRepository } from "../store/library-repository.js";
import { createLocalFileRepository } from "../store/local-file-repository.js";
import { createSettingsRepository } from "../store/settings-repository.js";
import { createShellStateRepository } from "../store/shell-state-repository.js";
import { createWatchRepository } from "../store/watch-repository.js";
import { createAccountServices } from "./account-setup.js";
import { createBackendCache } from "./backend-cache-setup.js";
import {
  createCollectionService,
  type CollectionService,
} from "./collection-service.js";
import { createFsDialogService, type FsDialogService } from "./fs-dialog-service.js";
import { createImageCacheService, rewriteImageUrl, type ImageCacheService } from "./image-cache-service.js";
import { createJobService, type JobService } from "./job-service.js";
import { createLibrary } from "./library-setup.js";
import { createLiveChannelsService, type LiveChannelsService } from "./live-channels-service.js";
import { createLocalMediaService, type LocalMediaService } from "./local-media-service.js";
import { createPosterFetchService, type PosterFetchService } from "./poster-fetch.js";
import { createProviderClient } from "./provider-client.js";
import { createScanService, type FolderScanner, type ScanService } from "./scan-service.js";
import { createSettingsService, type SettingsService } from "./settings-service.js";
import { createShellStateService, type ShellStateService } from "./shell-state-service.js";
import {
  createFavoritesService, createWatchService, type FavoritesService, type WatchService,
} from "./watch-service.js";
import { createTitleSources } from "./title-sources.js";

export interface ServiceOptions {
  dataDir: string;
  allowInsecureAdmin: boolean;
  /** The admin address before one is saved (config: the backend's port for this mode). */
  defaultAdminUrl: string;
  now: () => number;
  adminDatabase?: AdminDatabase;
  tursoDatabaseUrl: string;
  tursoAuthToken: string;
  jwtSecret: string;
  /** Test seams: the fetches the admin client and the image cache use, and the folder scanner. */
  adminFetch?: typeof fetch;
  imageFetch?: typeof fetch; scan?: FolderScanner;
  /** Electron lane: the native folder picker lives only here (docs/03 section 3.8). */
  openFolderPicker?: () => Promise<{ path: string } | "cancelled">;
  /** Test seam: `POST /api/fs/dialog` then takes `{ name }` under this root (3.8). */
  testFolderRoot?: string;
}
/** Every service of the fileserver, built once from the one database (docs/01 section 4.1). */
export async function createAppServices(options: ServiceOptions) {
  const database: Database = openDatabase(path.join(options.dataDir, "giga-stream.db"));
  const adminDatabase = options.adminDatabase ?? openAdminDatabase(options.tursoDatabaseUrl, options.tursoAuthToken);
  await validateAdminSchema(adminDatabase);
  const settingsRepository = createSettingsRepository(database);
  const settings = createSettingsService({
    repository: settingsRepository,
    allowInsecureAdmin: options.allowInsecureAdmin,
    now: options.now,
    defaultAdminUrl: options.defaultAdminUrl,
  });
  const shell = createShellStateService({ repository: createShellStateRepository(database), now: options.now });
  const channelState = createChannelStateRepository(database);
  const images: ImageCacheService = createImageCacheService({
    dataDir: options.dataDir,
    ...(options.imageFetch !== undefined && { fetch: options.imageFetch }),
    now: options.now,
  });
  images.prune();
  const adminUrl = () => settings.get().adminUrl;
  const adminSource = () => options.tursoDatabaseUrl || "injected-admin-database";
  // The one image-rewrite every passed-on address goes through (03 section 3.11): the cache
  // remembers the source so a later miss can fetch it; a source that fails the backend's address
  // rule stays as it is (docs/03 sections 3.11 and 7.3).
  const rewrite = (source: string): string => {
    images.rememberSource(source);
    return rewriteImageUrl(source) ?? source;
  };
  const adminChannels = createAdminChannelRepository(adminDatabase, adminUrl);
  const adminTitles = createAdminTitleRepository(adminDatabase);
  const {
    cache,
    channels: cachedChannels,
    titles: cachedTitles,
    titleQuery,
  } = createBackendCache({
    database,
    admin: adminChannels,
    catalog: adminTitles,
    adminUrl: adminSource,
    now: options.now,
  });
  const live: LiveChannelsService = createLiveChannelsService({
    cache,
    channels: cachedChannels,
    adminUrl,
    rewriteImageUrl: rewrite,
  });
  const titleSources = createTitleSources(createProviderClient({ fetch: options.adminFetch }), adminUrl);
  const collectionsRepo = createCollectionRepository(database);
  const filesRepo = createLocalFileRepository(database);
  const jobRepo = createJobRepository(database);
  const favoritesRepo = createFavoritesRepository(database);
  const watchRepo = createWatchRepository(database);
  const jobs: JobService = createJobService({ repository: jobRepo, now: options.now });
  jobs.atStart();
  const posters: PosterFetchService = createPosterFetchService({
    images,
    files: filesRepo,
    folders: collectionsRepo,
    enqueue: (kind, label, request) => jobs.enqueue(kind, label, request),
  });
  const scans: ScanService = createScanService({
    jobs,
    folders: collectionsRepo,
    files: filesRepo,
    posters,
    now: options.now, scan: options.scan,
  });
  jobs.register("folder-scan", scans.runner);
  jobs.register("poster-fetch", posters.runner);
  // `media-probe` rows stay kind-nameable, but the scan probes inline; no one enqueues them today.
  const dialog: FsDialogService = createFsDialogService({
    runtime: APP_RUNTIME,
    openFolderPicker: options.openFolderPicker,
    testFolderRoot: options.testFolderRoot ?? "",
    now: options.now,
  });
  const collections: CollectionService = createCollectionService({
    collections: collectionsRepo, scans, dialog, now: options.now,
  });
  const media: LocalMediaService = createLocalMediaService({ files: filesRepo, collections: collectionsRepo });
  const favorites: FavoritesService = createFavoritesService(favoritesRepo, options.now);
  const watches: WatchService = createWatchService({
    watches: watchRepo, now: options.now,
    watchedPercent: () => settings.get().watchedPercent,
    paused: () => settings.get().pauseHistory,
  });
  const { titles, library } = createLibrary({
    cache,
    cachedTitles,
    titleQuery,
    titlesAdmin: adminTitles,
    titleSources,
    adminUrl,
    libraryRepo: createLibraryRepository(database),
    favorites: favoritesRepo,
    collections: collectionsRepo,
    rewriteImageUrl: rewrite,
    now: options.now,
  });

  const accounts = createAccountServices(adminDatabase, options.jwtSecret, options.now);
  return {
    database,
    /** `GET /healthz` (docs/03 section 3.1): the database answers, and the fileserver's view of the backend. */
    health() {
      pingDatabase(database);
      const backend = live.backend();
      return {
        role: APP_ROLE,
        version: APP_VERSION,
        backend: backend.connected ? ("up" as const) : ("down" as const),
        ...(backend.readAt !== undefined && { readAt: backend.readAt }),
      };
    },
    settings: settings as SettingsService,
    shell: shell as ShellStateService,
    channelState,
    cache,
    live,
    jobs,
    images,
    scans,
    dialog,
    collections,
    media,
    favorites,
    watches,
    titles,
    library,
    ...accounts,
    async close(): Promise<void> {
      // The cache first: abort its syncs and wait for them, so none writes to a closed database.
      await cache.close();
      await jobs.close();
      database.close();
      adminDatabase.close();
    },
  };
}

export type AppServices = Awaited<ReturnType<typeof createAppServices>>;
