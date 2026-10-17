import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { rulesPack, lorePack, peoplePlacesPack, oneShotsPack, stableId, PACKS } from "../scripts/pack-docs.mjs";
import { SCENARIO } from "../module/scenarios/hurting-on-deck-22.mjs";

const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ["ledger-data.js", "station-briefs-data.js"]) vm.runInContext(fs.readFileSync(new URL(`../lore-src/${f}`, import.meta.url), "utf8"), ctx);
const entries = ctx.window.LEDGER;
const kinds = ctx.window.LEDGER_KINDS;
const briefs = ctx.window.STATION_BRIEFS;
const version = "0.0.0";
const rules = rulesPack({ entries, briefs, version });
const lore = lorePack({ entries, kinds, version });
const oneShots = oneShotsPack({ scenarios: [SCENARIO], version });
const peoplePlaces = peoplePlacesPack({ entries, version });
const all = [...rules, ...lore, ...oneShots, ...peoplePlaces];
const text = JSON.stringify(all);

test("ids are stable and unique, and every document has a pack key", () => {
  assert.equal(stableId("a", "b"), stableId("a", "b"));
  assert.match(stableId("x"), /^[A-Za-z0-9]{16}$/);
  const keys = [];
  for (const doc of all) {
    assert.ok(doc._key, doc.name);
    keys.push(doc._key);
    for (const p of doc.pages ?? []) { assert.ok(p._key?.startsWith(`!journal.pages!${doc._id}.`), p.name); keys.push(p._key); }
  }
  assert.equal(new Set(keys).size, keys.length);
});

test("every rules and skill entry is a page in the Rules pack; everything else is in Lore", () => {
  const pages = rules.flatMap(e => e.pages.map(p => p.name));
  for (const e of entries.filter(e => e.kind === "rules")) assert.ok(pages.includes(e.name), e.id);
  const loreNames = lore.filter(d => d._key.startsWith("!journal!")).map(d => d.name);
  for (const e of entries.filter(e => e.kind !== "rules")) assert.ok(loreNames.includes(e.name), e.id);
  assert.ok(rules.some(e => e.name === "Station Briefs" && e.pages.length === briefs.length + 1));
});

test("every Ledger link becomes a Foundry link, to a document that exists", () => {
  assert.ok(!text.includes("[["), "an unconverted [[link]]");
  const ids = new Set(all.flatMap(d => [d._id, ...(d.pages ?? []).map(p => p._id)]));
  for (const m of text.matchAll(/@UUID\[Compendium\.cantica\.(rules|lore)\.JournalEntry\.([A-Za-z0-9]{16})(?:\.JournalEntryPage\.([A-Za-z0-9]{16}))?\]/g)) {
    assert.ok(ids.has(m[2]), m[0]);
    if (m[3]) assert.ok(ids.has(m[3]), m[0]);
  }
});

test("no art: the only pictures are Foundry's built-in icons", () => {
  for (const m of text.matchAll(/"(?:img|src)":"([^"]*)"/g)) assert.match(m[1], /^icons\/svg\//, m[1]);
  assert.ok(!/\.(jpe?g|png|webp|gif)\b/i.test(text));
});

test("the one-shot is GM material: its NPCs and notes are hidden, its pack is GM only", () => {
  const [adventure] = oneShots;
  assert.equal(adventure.actors.length, SCENARIO.npcs.length + SCENARIO.places.length);
  for (const npc of adventure.actors.filter(a => a.type === "npc")) assert.equal(npc.ownership.default, 0, npc.name);
  for (const j of adventure.journal) assert.equal(j.ownership.default, 0);
  const system = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  const pack = system.packs.find(p => p.name === "one-shots");
  assert.equal(pack.type, PACKS["one-shots"].type);
  assert.equal(pack.ownership.PLAYER, "NONE");
  assert.equal(pack.ownership.TRUSTED, "NONE");
  for (const name of Object.keys(PACKS)) assert.ok(system.packs.some(p => p.name === name && p.path === `packs/${name}`), name);
});

test("People & Places: an NPC for every person (hidden) and a Scene Card for every place, with the spec's stat blocks", () => {
  const npcs = peoplePlaces.filter(d => d.type === "npc");
  const cards = peoplePlaces.filter(d => d.type === "card");
  assert.equal(npcs.length, entries.filter(e => e.kind === "people").length);
  assert.equal(cards.length, entries.filter(e => e.kind === "places").length);
  for (const npc of npcs) {
    assert.equal(npc.ownership.default, 0, npc.name);
    assert.ok(npc._key.startsWith("!actors!"));
    assert.ok(npc.system.notes.length > 20, npc.name);
  }
  const aiwen = npcs.find(n => n.flags.cantica.loreId === "sister-aiwen");
  assert.deepEqual([aiwen.system.rating, aiwen.system.tier, aiwen.system.roleTag], [2, "major", "Liturgist Cantor"]);
  for (const card of cards) {
    assert.equal(card.prototypeToken.width, 12);
    assert.equal(card.prototypeToken.actorLink, true);
  }
  const system = JSON.parse(fs.readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  const pack = system.packs.find(p => p.name === "people-places");
  assert.equal(pack.type, "Actor");
  assert.equal(pack.ownership.PLAYER, "NONE");
  assert.ok(!system.scripts.includes("lore/ledger-data.js"), "the Ledger's data is no longer loaded into Foundry");
});

test("a one-shot's places and People & Places' cards start hidden from players, until the GM shares them", () => {
  const cards = [...oneShots[0].actors, ...peoplePlaces].filter(a => a.type === "card");
  assert.ok(cards.length > 7);
  for (const card of cards) {
    assert.equal(card.ownership.default, 0, card.name);
    assert.equal(card.flags.cantica.startHidden, true, card.name);
  }
  assert.ok(peoplePlaces.filter(a => a.type === "card").every(c => c.flags.cantica.loreId), "cards keep their lore id");
});
