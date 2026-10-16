import { buildApp } from "./build-app.js";
import { config } from "./config.js";

/** The fileserver with no desktop shell around it: for a plain browser and the headless checks. */
const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`giga-stream fileserver ready on http://${config.host}:${config.port}/ serving ${config.webDist}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
