// Converts an iptv-org clone's USA playlists into the giga-stream-compatible M3U snapshot
// (`playlists/us.m3u`, docs/03 section 7.2c): every `streams/us*.m3u` of the clone unioned,
// https-only addresses (the address rule refuses anything else), deduped by name+url (the
// sync's own key, `m3uKeyOf`), source order kept.
//
//   node scripts/make-playlists.mjs <path to iptv-org clone>
//
// One file per region is written to `playlists/<region>.m3u`. The snapshot is the reviewed
// import artifact; the playlist record registered with the backend keeps fetching the live
// upstream, so the sync refreshes rather than re-imports this file.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const clone = process.argv[2];
if (!clone) {
  console.error("usage: node scripts/make-playlists.mjs <path to iptv-org clone>");
  process.exit(2);
}
const MAX_ENTRIES = 5000; // the sync's per-playlist entry cap (docs/03 section 7.2c)

const streams = path.join(clone, "streams");
const files = readdirSync(streams).filter((name) => /^us.*\.m3u$/.test(name)).sort();
if (files.length === 0) {
  console.error(`no us*.m3u files in ${streams}`);
  process.exit(1);
}

mkdirSync("playlists", { recursive: true });
const out = [`#EXTM3U`, `# Converted from iptv-org/iptv (${files.join(" ")}) into the giga-stream playlist`, `# format (docs/03 section 7.2c): https-only addresses, deduped by name+url, source order kept.`];
const keys = new Set();
let seen = 0;
let refused = 0;
for (const file of files) {
  const lines = readFileSync(path.join(streams, file), "utf8").split(/\r?\n/);
  let name = null;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      name = line.slice(line.indexOf(",") + 1).trim();
      continue;
    }
    if (line.startsWith("http")) {
      if (name === null) continue;
      if (!line.startsWith("https://")) {
        refused += 1;
        name = null;
        continue;
      }
      const key = `${name}|${line}`;
      if (keys.has(key)) continue;
      keys.add(key);
      if (seen >= MAX_ENTRIES) {
        console.error(`more than ${MAX_ENTRIES} entries; not converted`);
        process.exit(1);
      }
      out.push(`#EXTINF:-1,${name}`);
      out.push(line);
      seen += 1;
      name = null;
    }
  }
}
const target = path.join("playlists", "us.m3u");
writeFileSync(target, out.join("\n") + "\n");
console.log(`${target}: ${seen} entries, ${refused} http refused`);
