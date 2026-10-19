#!/usr/bin/env node
// Stage the built admin console into the backend's public/ folder (the
// @fastify/static root the backend serves at / behind the fileserver's
// /admin strip). A build-artifact mover: it copies, it never writes source.
import { cpSync, existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "src", "admin", "dist");
const target = path.join(root, "src", "backend", "public");
const entry = path.join(source, "index.html");

if (!existsSync(entry) || !statSync(entry).isFile()) {
  console.error("stage-admin-public: src/admin/dist/index.html is missing — build the admin console first");
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log("staged src/admin/dist -> src/backend/public");
