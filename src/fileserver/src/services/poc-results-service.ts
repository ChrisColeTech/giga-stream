import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Saves one proof-of-concept result (docs/14 section 6) as a JSON file; answers its name. */
export function createPocResultsService(resultsDir: string) {
  const safe = (value: string): string => value.replace(/[^a-z0-9-]/gi, "") || "unknown";

  return {
    async save(providerId: string, runtime: string, result: unknown): Promise<{ file: string }> {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const file = `${safe(providerId)}-${safe(runtime)}-${stamp}.json`;
      await mkdir(resultsDir, { recursive: true });
      await writeFile(path.join(resultsDir, file), JSON.stringify(result, null, 2));
      return { file: `results/${file}` };
    },
  };
}

export type PocResultsService = ReturnType<typeof createPocResultsService>;
