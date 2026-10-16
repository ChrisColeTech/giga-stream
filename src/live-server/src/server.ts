import { buildLiveServer } from "./app.ts";
import { config } from "./config.ts";

let server: Awaited<ReturnType<typeof buildLiveServer>>;
try {
  server = await buildLiveServer();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

try {
  await server.app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  server.app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void server.app.close().then(() => process.exit(0)));
}
