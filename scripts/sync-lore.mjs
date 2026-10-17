/**
 * Copies the website's lore into this system's lore-src/ folder: the Ledger's entries (ledger-data.js), the Station Briefs
 * (station-briefs-data.js), and the art the Ledger's entries use. The website is where the lore is written; this system
 * keeps its own copy so it builds and releases on its own, without the website repository.
 *
 * Run it when the website's lore changes:
 *   node scripts/sync-lore.mjs                 (this folder is foundry/ inside the website repository)
 *   node scripts/sync-lore.mjs --site ../cantica   (a separate checkout of the website repository)
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const foundryRoot = path.resolve(here, "..");
const flag = process.argv.indexOf("--site");
const site = path.resolve(flag > -1 ? process.argv[flag + 1] : path.join(foundryRoot, ".."));
const dest = path.join(foundryRoot, "lore-src");

const ledger = path.join(site, "ledger-data.js");
const briefs = path.join(site, "station-briefs-data.js");
for (const file of [ledger, briefs]) {
  if (!fs.existsSync(file)) throw new Error(`Not found: ${file}\nRun this inside the website repository, or pass --site <path to a checkout of it>.`);
}

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ledger, "utf8"), ctx);
const entries = ctx.window.LEDGER ?? [];
if (!entries.length) throw new Error("ledger-data.js has no entries");

fs.mkdirSync(path.join(dest, "assets"), { recursive: true });
fs.copyFileSync(ledger, path.join(dest, "ledger-data.js"));
fs.copyFileSync(briefs, path.join(dest, "station-briefs-data.js"));

const wanted = new Set();
const missing = [];
for (const entry of entries) {
  if (!entry.img) continue;
  const from = path.join(site, entry.img);
  const name = path.basename(entry.img);
  if (!fs.existsSync(from)) { missing.push(`${entry.id}: ${entry.img}`); continue; }
  fs.copyFileSync(from, path.join(dest, "assets", name));
  wanted.add(name);
}
if (missing.length) throw new Error("Missing art:\n  " + missing.join("\n  "));

// Art no entry uses any more is dropped.
for (const file of fs.readdirSync(path.join(dest, "assets"))) {
  if (!wanted.has(file)) fs.rmSync(path.join(dest, "assets", file));
}

console.log(`lore synced from ${site}: ${entries.length} entries, ${wanted.size} images -> lore-src/`);
