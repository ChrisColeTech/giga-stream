const controller = new AbortController();
const stop = (): void => controller.abort();
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, stop);

try {
  // Load config inside the guarded entrypoint: invalid env must fail without dumping its values.
  const { config } = await import("./config.js");
  const { openCatalogWorker } = await import("./services/catalog-worker-runtime.js");
  const { executeCatalogWorker } = await import("./services/catalog-worker-execution.js");
  process.exitCode = await executeCatalogWorker({
    jobId: config.SYNC_JOB_ID,
    tmdbToken: config.TMDB_READ_TOKEN,
    signal: controller.signal,
    open: () => openCatalogWorker(config),
    log: (event) => console.log(JSON.stringify(event)),
  });
} catch {
  console.error(JSON.stringify({ event: "failed", code: "worker.startup_failed" }));
  process.exitCode = 1;
} finally {
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.off(signal, stop);
}

export {};
