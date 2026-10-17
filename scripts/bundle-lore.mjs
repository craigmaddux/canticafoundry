/**
 * Builds lore/ for the system zip: the Station Briefs, which Register With Gloss reads, from this system's own lore-src/
 * folder (kept in step with the website by scripts/sync-lore.mjs). The Ledger's entries go into the compendium packs
 * instead (scripts/build-packs.mjs). No art: the system ships none.
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
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(src, "station-briefs-data.js"), path.join(out, "station-briefs-data.js"));

console.log(`lore bundled: ${briefs.length} Station Briefs -> lore/ (the ${entries.length} Ledger entries go into the packs)`);
