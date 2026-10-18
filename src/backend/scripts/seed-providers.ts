import { buildApp } from "../src/app.js";
import { send, signIn } from "../test/test-app.js";
import { EMBED_PROVIDER_CATALOG } from "../src/constants/embed-providers.js";
import { STREAM_PROVIDER_CATALOG } from "../src/constants/stream-providers.js";

import path from "node:path";
import { mkdtempSync } from "node:fs";
import os from "node:os";

const ADMIN_USERNAME = "admin@example.test";
const ADMIN_PASSWORD = "admin-password-123";

/** The whole catalog (docs/18 section 2's embed hosts, then the CinePro stream rows). */
const CATALOG = [...EMBED_PROVIDER_CATALOG, ...STREAM_PROVIDER_CATALOG];

async function seedProviders() {
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : mkdtempSync(path.join(os.tmpdir(), "giga-seed-"));
  const app = await buildApp({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    DATA_DIR: dataDir,
    JWT_SECRET: process.env.JWT_SECRET || "test-secret-that-is-at-least-32-characters",
    ADMIN_BOOTSTRAP_USERNAME: ADMIN_USERNAME,
    ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASSWORD,
    TLS_CERT_FILE: "",
    TLS_KEY_FILE: "",
    TRUST_PROXY: false,
    ALLOW_INSECURE_HTTP: false,
    CORS_ORIGINS: "",
    TMDB_READ_TOKEN: "",
    SEED_TEST_CHANNELS: false,
  });

  const access = (await signIn(app)).access;

  // Check if already seeded
  const existing = await send(app, "GET", "/api/providers");
  if (existing.body.data.items.length > 0) {
    console.log("Providers already seeded, skipping.");
    await app.close();
    return;
  }

  for (const provider of CATALOG) {
    const result = await send(app, "POST", "/api/providers", provider, access);
    if (result.status !== 201) {
      console.log(`${provider.source}: ${result.status} - ${JSON.stringify(result.body)}`);
    } else {
      console.log(`${provider.source}: ${result.status}`);
    }
  }

  await app.close();
}

seedProviders().catch((e) => {
  console.error(e);
  process.exit(1);
});
