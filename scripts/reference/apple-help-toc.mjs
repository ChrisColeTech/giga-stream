/*
 * List every topic of Apple's Mac User Guide (macOS 26) with its URL, into
 * docs/reference/macos-spotlight/GUIDE-TOPICS.tsv (status, slug, title, href). The guide's table of
 * contents is in the side panel of any topic page, so one topic page is opened and its links read.
 *
 *   node scripts/reference/apple-help-toc.mjs
 *
 * status: saved = a <slug>.md already exists in the output folder; unsaved = not on disk. Save a
 * page by adding its URL to scripts/reference/apple-help-urls.txt and running apple-help-save.mjs.
 * Adapted from giga-cut-poc/scripts/fcpx-toc.mjs; playwright-core comes from giga-cut-poc.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire("D:/Projects/giga-cut-poc/package.json")("playwright-core");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const outDir = path.join(root, "docs", "reference", "macos-spotlight");
const START = "https://support.apple.com/en-ca/guide/mac-help/mchlp1008/26/mac/26";
const saved = new Set(existsSync(outDir) ? readdirSync(outDir).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)) : []);

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--mute-audio"] });
const page = await (await browser.newContext()).newPage();
await page.goto(START, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => ({ title: a.textContent.replace(/\s+/g, " ").trim(), href: a.href })));
await browser.close();

/* A topic is linked more than once; keep the title-cased text. Slug = topic id plus the version when present. */
const topics = new Map();
for (const link of links) {
  const match = /\/guide\/mac-help\/([a-z0-9-]+)\/(?:(\d[\d.]*)\/)?mac/.exec(link.href);
  if (match === null || link.title === "") continue;
  const slug = match[2] === undefined ? match[1] : `${match[1]}-${match[2]}`;
  const known = topics.get(slug);
  if (known === undefined || (/^[A-Z]/.test(link.title) && !/^[A-Z]/.test(known.title))) topics.set(slug, { title: link.title, href: link.href });
}
if (topics.size < 100) { console.error(`only ${topics.size} topics found: the guide page's markup has probably changed`); process.exit(1); }

const rows = [...topics].toSorted((a, b) => a[1].title.localeCompare(b[1].title, "en", { sensitivity: "base" }))
  .map(([slug, { title, href }]) => `${saved.has(slug) ? "saved" : "unsaved"}\t${slug}\t${title}\t${href}`);
const header = [`# Apple's Mac User Guide (macOS 26): every topic found in the side panel (${new Date().toISOString().slice(0, 10)}).`, "# status<TAB>slug<TAB>title<TAB>href. Written by scripts/reference/apple-help-toc.mjs."];
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "GUIDE-TOPICS.tsv"), `${[...header, ...rows].join("\n")}\n`);
console.log(`${rows.length} topics written to ${path.relative(root, path.join(outDir, "GUIDE-TOPICS.tsv"))}`);
