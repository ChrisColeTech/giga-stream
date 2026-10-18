/*
 * Save Apple's macOS Spotlight help pages, one file per page, into docs/reference/macos-spotlight/.
 * The text goes to <slug>.md; every image on the page is downloaded to
 * docs/reference/macos-spotlight/images/<slug>/ and referenced in the .md where it sits in the page,
 * as ![alt](images/<slug>/NN-name.ext). Adapted from giga-cut-poc/scripts/fcpx-save.mjs.
 *
 *   node scripts/reference/apple-help-save.mjs                  every URL in apple-help-urls.txt
 *   node scripts/reference/apple-help-save.mjs <url> [<url>…]   just these
 *
 * Uses the installed Chrome through playwright-core, imported from giga-cut-poc's node_modules
 * (giga-stream does not depend on it). A page that fails is reported and skipped; an image that
 * fails keeps its remote URL in the .md and is reported, so nothing is silently lost.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire("D:/Projects/giga-cut-poc/package.json")("playwright-core");

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const root = path.resolve(here, "..", "..");
const outDir = path.join(root, "docs", "reference", "macos-spotlight");
const imageDir = path.join(outDir, "images");
const listFile = path.join(here, "apple-help-urls.txt");

const urls = process.argv.length > 2
  ? process.argv.slice(2)
  : readFileSync(listFile, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));

/** Topic id plus the guide version when the URL has one (".../mchlp1008/26/mac/26" -> "mchlp1008-26"). */
const slug = (url) => {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const topic = parts[parts.indexOf("guide") + 2] ?? "page";
  const version = parts[parts.indexOf("guide") + 3];
  return /^\d[\d.]*$/.test(version ?? "") ? `${topic}-${version}` : topic;
};
const EXTENSIONS = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg" };
const safe = (name) => name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const failed = [];
const imageFailures = [];
let imageCount = 0;

/** Save one image and answer its path relative to the output folder, or null when it could not be fetched. */
async function saveImage(pageSlug, index, src) {
  const folder = path.join(imageDir, pageSlug);
  mkdirSync(folder, { recursive: true });
  const prefix = String(index + 1).padStart(2, "0");
  if (src.startsWith("data:")) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(src);
    if (match === null) return null;
    const bytes = match[2] === undefined ? Buffer.from(decodeURIComponent(match[3])) : Buffer.from(match[3], "base64");
    const file = `${prefix}-inline${EXTENSIONS[match[1]] ?? ".bin"}`;
    writeFileSync(path.join(folder, file), bytes);
    return `images/${pageSlug}/${file}`;
  }
  const response = await context.request.get(src, { timeout: 30_000 });
  if (!response.ok()) return null;
  const type = (response.headers()["content-type"] ?? "").split(";")[0].trim();
  const base = safe(decodeURIComponent(new URL(src).pathname.split("/").filter(Boolean).at(-1) ?? "image"));
  const extension = path.extname(base) !== "" ? "" : EXTENSIONS[type] ?? "";
  const file = `${prefix}-${base}${extension}`;
  writeFileSync(path.join(folder, file), await response.body());
  return `images/${pageSlug}/${file}`;
}

for (const url of urls) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector(".book-content", { timeout: 15_000 });
    /* Images load lazily: scroll the page through once so every one has its source. */
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 60)); }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const { title, text, images } = await page.evaluate(() => {
      const article = document.querySelector(".book-content") ?? document.querySelector("#article-section");
      const found = [];
      for (const img of article.querySelectorAll("img")) {
        const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
        if (src === "") continue;
        const absolute = src.startsWith("data:") ? src : new URL(src, location.href).href;
        let at = found.findIndex((one) => one.src === absolute);
        if (at < 0) { at = found.length; found.push({ src: absolute, alt: (img.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim() }); }
        img.replaceWith(document.createTextNode(` [[IMG:${at}]] `));
      }
      return { title: document.title, text: article.innerText, images: found };
    });
    const pageSlug = slug(url);
    const saved = [];
    for (let at = 0; at < images.length; at++) {
      try { saved.push(await saveImage(pageSlug, at, images[at].src)); }
      catch (error) { saved.push(null); imageFailures.push(`${url} image ${at + 1}: ${error.message}`); }
      if (saved[at] === null) imageFailures.push(`${url} image ${at + 1}: not downloaded (${images[at].src.slice(0, 100)})`);
      else imageCount++;
    }
    const body = text.replace(/\[\[IMG:(\d+)\]\]/g, (_, n) => {
      const image = images[Number(n)];
      return `![${image.alt}](${saved[Number(n)] ?? image.src})`;
    });
    const file = path.join(outDir, `${pageSlug}.md`);
    writeFileSync(file, `# ${title}\n\n${url}\n\n---\n\n${body.trim()}\n`);
    console.log(`saved ${path.relative(root, file)} (${images.length} images)`);
  } catch (error) {
    failed.push(url);
    console.error(`FAILED ${url}: ${error.message}`);
  }
}

await browser.close();
console.log(`\n${urls.length - failed.length} saved, ${failed.length} failed, ${imageCount} images downloaded`);
if (imageFailures.length) console.error(`\n${imageFailures.length} image problems:\n${imageFailures.join("\n")}`);
if (failed.length) process.exitCode = 1;
