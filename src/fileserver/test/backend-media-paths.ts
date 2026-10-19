import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Creates only the paths the backend seed validates; these tests never decode or stream their contents. */
export function makeSeedMediaPaths(dataDir: string): string {
  const fixtureDir = path.join(dataDir, "fixtures");
  const liveDir = path.join(fixtureDir, "live");
  mkdirSync(liveDir, { recursive: true });
  for (const kind of ["news", "sports", "music", "kids"])
    for (let part = 1; part <= 3; part += 1) writeFileSync(path.join(liveDir, `${kind}-${part}.mp4`), "");
  return fixtureDir;
}
