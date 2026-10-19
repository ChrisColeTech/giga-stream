import { buildApp } from "./app.js";
import { config } from "./config.js";
import { AppError } from "./constants/errors.js";

let app: Awaited<ReturnType<typeof buildApp>>;
try {
  app = await buildApp();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  // The details say which migration failed and why (an AppError carries them); the message alone hides the cause.
  if (error instanceof AppError && error.details !== undefined) console.error(JSON.stringify(error.details));
  process.exit(1);
}

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
