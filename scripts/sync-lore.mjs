/**
 * Copies the website's lore into this system's lore-src/ folder: the Ledger's entries (ledger-data.js), the Station Briefs
 * (station-briefs-data.js). Never the art: the system ships none. The website is where the lore is written; this system
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

fs.mkdirSync(dest, { recursive: true });
// The system ships no art: the website's pictures stay on the website, and the entries' img fields are dropped.
const stripArt = text => text.replace(/[ \t]*img: "[^"]*",[ \t]*(\r?\n)?/g, "").replace(/,[ \t]*img: "[^"]*"/g, "");
fs.writeFileSync(path.join(dest, "ledger-data.js"), stripArt(fs.readFileSync(ledger, "utf8")));
fs.copyFileSync(briefs, path.join(dest, "station-briefs-data.js"));
fs.rmSync(path.join(dest, "assets"), { recursive: true, force: true });

console.log(`lore synced from ${site}: ${entries.length} entries (no art) -> lore-src/`);
