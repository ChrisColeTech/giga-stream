import os from "node:os";
import path from "node:path";

import { openDatabase, type Database } from "../store/database.js";
import { createChannelStateRepository } from "../store/channel-state-repository.js";
import { createSettingsRepository } from "../store/settings-repository.js";
import { createShellStateRepository } from "../store/shell-state-repository.js";
import { createAdminClient } from "./admin-client.js";
import { createLiveChannelsService, type LiveChannelsService } from "./live-channels-service.js";
import { createSettingsService, type SettingsService } from "./settings-service.js";
import { createShellStateService, type ShellStateService } from "./shell-state-service.js";
import { createStreamProbe } from "./stream-probe.js";

export interface ServiceOptions {
  dataDir: string;
  allowInsecureAdmin: boolean;
  liveViewTtlMs: number;
  now: () => number;
  /** Test seams: the fetch the admin client and the probe use. */
  adminFetch?: typeof fetch;
  probeFetch?: typeof fetch;
}

/** Every service of the fileserver, built once from the one database (docs/01 section 4.1). */
export function createAppServices(options: ServiceOptions) {
  const database: Database = openDatabase(path.join(options.dataDir, "giga-stream.db"));
  const settingsRepository = createSettingsRepository(database);
  const settings = createSettingsService({
    repository: settingsRepository,
    allowInsecureAdmin: options.allowInsecureAdmin,
    now: options.now,
  });
  const shell = createShellStateService({ repository: createShellStateRepository(database), now: options.now });
  const channelState = createChannelStateRepository(database);
  const live: LiveChannelsService = createLiveChannelsService({
    admin: createAdminClient({ fetch: options.adminFetch }),
    probe: createStreamProbe({ fetch: options.probeFetch }),
    adminUrl: () => settings.get().adminUrl,
    ttlMs: options.liveViewTtlMs,
    now: options.now,
  });

  return {
    database,
    settings: settings as SettingsService,
    shell: shell as ShellStateService,
    channelState,
    live,
    close: (): void => database.close(),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;

/** The default data folder (docs/03 section 1): `~/.giga-stream`, overridable with `DATA_DIR`. */
export function defaultDataDir(): string {
  return process.env.DATA_DIR || path.join(os.homedir(), ".giga-stream");
}
