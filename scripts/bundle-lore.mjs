/**
 * Builds lore/ for the system zip: the Ledger's entries, the Station Briefs, and the art the entries use, from this
 * system's own lore-src/ folder (kept in step with the website by scripts/sync-lore.mjs).
 *
 * Run from anywhere:  node scripts/bundle-lore.mjs   (the release workflow does this)
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const foundryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(foundryRoot, "lore-src");
const out = path.join(foundryRoot, "lore");

const load = (file, key) => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(src, file), "utf8"), ctx);
  const data = ctx.window[key] ?? [];
  if (!data.length) throw new Error(`${file} has no ${key}`);
  return data;
};

const entries = load("ledger-data.js", "LEDGER");
const briefs = load("station-briefs-data.js", "STATION_BRIEFS");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "assets"), { recursive: true });
fs.copyFileSync(path.join(src, "ledger-data.js"), path.join(out, "ledger-data.js"));
fs.copyFileSync(path.join(src, "station-briefs-data.js"), path.join(out, "station-briefs-data.js"));

const missing = [];
const copied = new Set();
for (const entry of entries) {
  if (!entry.img) continue;
  const name = path.basename(entry.img);
  const from = path.join(src, "assets", name);
  if (!fs.existsSync(from)) { missing.push(`${entry.id}: ${name}`); continue; }
  if (!copied.has(name)) { fs.copyFileSync(from, path.join(out, "assets", name)); copied.add(name); }
}
if (missing.length) throw new Error("Missing art (run scripts/sync-lore.mjs):\n  " + missing.join("\n  "));

console.log(`lore bundled: ${entries.length} entries, ${briefs.length} Station Briefs, ${copied.size} images -> lore/`);
