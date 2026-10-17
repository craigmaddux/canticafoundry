/**
 * Builds the system's compendium packs into packs/ (Foundry's LevelDB format), from the Ledger, the Station Briefs and
 * the one-shot scenarios. See scripts/pack-docs.mjs for what goes in each pack. The release workflow runs this.
 *
 *   npm install          (once: the Foundry CLI that writes the packs)
 *   node scripts/build-packs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { PACKS, rulesPack, lorePack, peoplePlacesPack, oneShotsPack } from "./pack-docs.mjs";
import { SCENARIO as HURTING_ON_DECK_22 } from "../module/scenarios/hurting-on-deck-22.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const system = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
const version = system.version;

const ctx = { window: {} };
vm.createContext(ctx);
for (const file of ["ledger-data.js", "station-briefs-data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "lore-src", file), "utf8"), ctx);
}
const entries = ctx.window.LEDGER ?? [];
const kinds = ctx.window.LEDGER_KINDS ?? [];
const briefs = ctx.window.STATION_BRIEFS ?? [];
if (!entries.length) throw new Error("lore-src/ledger-data.js has no entries");

const built = {
  rules: rulesPack({ entries, briefs, version }),
  lore: lorePack({ entries, kinds, version }),
  "people-places": peoplePlacesPack({ entries, version }),
  "one-shots": oneShotsPack({ scenarios: [HURTING_ON_DECK_22], version })
};

const srcRoot = path.join(root, "build", "packs-src");
fs.rmSync(srcRoot, { recursive: true, force: true });
for (const [name, docs] of Object.entries(built)) {
  if (!PACKS[name]) throw new Error(`no pack called ${name} in pack-docs.mjs`);
  const dir = path.join(srcRoot, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const doc of docs) {
    const slug = String(doc.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "doc";
    fs.writeFileSync(path.join(dir, `${slug}_${doc._id}.json`), JSON.stringify(doc, null, 2));
  }
  const dest = path.join(root, "packs", name);
  fs.rmSync(dest, { recursive: true, force: true });
  await compilePack(dir, dest);
  console.log(`packs/${name}: ${docs.length} documents`);
}
