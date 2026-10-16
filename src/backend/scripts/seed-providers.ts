import { buildApp } from "../src/app.js";
import { send, signIn } from "../test/test-app.js";

import path from "node:path";
import { mkdtempSync } from "node:fs";
import os from "node:os";

const OWNER_EMAIL = "owner@example.test";
const OWNER_PASSWORD = "owner-password-123";

async function seedProviders() {
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : mkdtempSync(path.join(os.tmpdir(), "giga-seed-"));
  const app = await buildApp({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    DATA_DIR: dataDir,
    JWT_SECRET: process.env.JWT_SECRET || "test-secret-that-is-at-least-32-characters",
    ADMIN_BOOTSTRAP_EMAIL: OWNER_EMAIL,
    ADMIN_BOOTSTRAP_PASSWORD: OWNER_PASSWORD,
    TLS_CERT_FILE: "",
    TLS_KEY_FILE: "",
    TRUST_PROXY: false,
    ALLOW_INSECURE_HTTP: false,
    CORS_ORIGINS: "",
    TMDB_READ_TOKEN: "",
    SEED_TEST_CHANNELS: false,
    ALLOW_LOOPBACK_STREAMS: false,
  });

  const access = (await signIn(app)).access;

  // Check if already seeded
  const existing = await send(app, "GET", "/api/providers");
  if (existing.body.data.items.length > 0) {
    console.log("Providers already seeded, skipping.");
    await app.close();
    return;
  }

  const providers = [
    { id: "vidsrc", name: "VidSrc", source: "vidsrc", apiKey: "" },
    { id: "vixsrc", name: "VixSrc", source: "vixsrc", apiKey: "" },
    { id: "vidzee", name: "VidZee", source: "vidzee", apiKey: "" },
    { id: "cinesu", name: "CineSu", source: "cinepro", apiKey: "" },
    { id: "fsharetv", name: "FshareTV", source: "cinepro", apiKey: "" },
    { id: "icefy", name: "Icefy", source: "cinepro", apiKey: "" },
    { id: "peachify", name: "Peachify", source: "cinepro", apiKey: "" },
    { id: "popr", name: "Popr", source: "cinepro", apiKey: "" },
    { id: "streammafia", name: "MafiaEmbed", source: "cinepro", apiKey: "" },
    { id: "tulnex", name: "Tulnex", source: "cinepro", apiKey: "" },
    { id: "vidapi", name: "VidApi", source: "cinepro", apiKey: "" },
    { id: "videasy", name: "Videasy", source: "cinepro", apiKey: "" },
    { id: "vidnest", name: "VidNest", source: "cinepro", apiKey: "" },
    { id: "vidrock", name: "VidRock", source: "cinepro", apiKey: "" },
  ];

  for (const p of providers) {
    const result = await send(app, "POST", "/api/providers", {
      name: p.name,
      source: p.source,
      api_key: p.apiKey,
    }, access);
    if (result.status === 422) {
      console.log(`${p.id}: ${result.status} - ${JSON.stringify(result.body)}`);
    } else {
      console.log(`${p.id}: ${result.status}`);
    }
  }

  await app.close();
}

seedProviders().catch((e) => {
  console.error(e);
  process.exit(1);
});
