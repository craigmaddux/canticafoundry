/**
 * The system's compendium packs, as plain document data: built from the Ledger (lore-src/ledger-data.js), the Station
 * Briefs and the one-shot scenarios. Pure functions with no Foundry dependency, so a test can check them; the release
 * compiles them into Foundry's pack format with scripts/build-packs.mjs.
 *
 *   rules      Cantica: Rules       journal, one entry per part of the rules, one page per rule, and the Station Briefs
 *   lore       Cantica: Lore        journal, one entry per person, place, group, term and rumor, in folders by kind
 *   one-shots  Cantica: One-Shots   Adventures, GM only: a one-shot's NPCs, Scene Cards and GM notes, imported in one go
 *
 * No art: every picture is one of Foundry's built-in icons. Ids are made from stable names, so a document keeps its id
 * from release to release, and links between packs keep working.
 */
import crypto from "node:crypto";
import { paragraphs, escapeHtml } from "../module/lore-text.mjs";
import { splitTags } from "../module/npc-tags.mjs";
import { SYSTEM_ID, DEFAULT_NPC_IMG, DEFAULT_CARD_IMG } from "../module/config.mjs";

export const PACKS = {
  rules: { label: "Cantica: Rules", type: "JournalEntry" },
  lore: { label: "Cantica: Lore", type: "JournalEntry" },
  "one-shots": { label: "Cantica: One-Shots (GM)", type: "Adventure" }
};

const OBSERVER = 2;
const NONE = 0;
const INHERIT = -1;
const HTML = 1;
const ADVENTURE_IMG = "icons/svg/book.svg";

/** A 16-character id, always the same for the same name. */
export function stableId(...parts) {
  const hash = crypto.createHash("sha256").update(parts.join("\u0000")).digest();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) id += alphabet[hash[i] % alphabet.length];
  return id;
}

/** The parts of the rules, in the order the website's Rules page uses. */
export const RULE_PARTS = [
  { key: "roll", name: "Rolling the dice", entries: ["rules-core", "rules-pool", "rules-gear", "rules-difficulty", "rules-margin", "rules-violet", "rules-odds"] },
  { key: "character", name: "Your character", entries: ["rules-creation", "rules-station-briefs", "rules-traits", "rules-hindrances", "rules-gift"] },
  { key: "skills", name: "The skills", skills: true },
  { key: "currencies", name: "Stamps and Scrutiny", entries: ["rules-stamps", "rules-scrutiny"] },
  { key: "conflict", name: "Conflict and harm", entries: ["rules-notices", "rules-recovery", "rules-acting", "rules-resisting", "rules-resist-skills", "rules-npcs", "rules-hazards"] },
  { key: "scenes", name: "Scenes", entries: ["rules-scene-cards", "rules-summary", "rules-dockets", "rules-record"] },
  { key: "growth", name: "Growing", entries: ["rules-compline", "rules-grade", "rules-commendations"] }
];

const stats = version => ({ coreVersion: "13.351", systemId: SYSTEM_ID, systemVersion: version });

const page = (entryId, { id, name, content, sort, level = 1 }) => ({
  _id: id, _key: `!journal.pages!${entryId}.${id}`,
  name, type: "text", sort,
  title: { show: true, level },
  text: { format: HTML, content },
  ownership: { default: INHERIT }, flags: {}
});

const journalEntry = ({ id, name, folder = null, sort = 0, pages, ownership = OBSERVER, version }) => ({
  _id: id, _key: `!journal!${id}`,
  name, folder, sort, pages,
  ownership: { default: ownership }, flags: {}, _stats: stats(version)
});

const folderDoc = ({ id, name, type, sort = 0, parent = null, key = true }) => ({
  _id: id, ...(key ? { _key: `!folders!${id}` } : {}),
  name, type, folder: parent, sort, sorting: "m", color: null, description: "", flags: {}
});

/**
 * Where every Ledger entry lives in the packs, so [[id|label]] links can point at it: rules entries are pages of a
 * rules part; everything else is an entry of its own in the lore pack.
 */
export function locate(entries) {
  const where = {};
  const rules = entries.filter(e => e.kind === "rules");
  const placed = new Set();
  for (const part of RULE_PARTS) {
    const entryId = stableId("rules", part.key);
    const ids = part.skills ? rules.filter(e => e.id.startsWith("skill-")).map(e => e.id) : part.entries;
    for (const id of ids) {
      where[id] = { pack: "rules", entryId, pageId: stableId("rules-page", id) };
      placed.add(id);
    }
  }
  // Any rules entry the parts don't name yet still gets a home, at the end.
  const extraId = stableId("rules", "more");
  for (const e of rules) if (!placed.has(e.id)) where[e.id] = { pack: "rules", entryId: extraId, pageId: stableId("rules-page", e.id) };
  for (const e of entries) if (e.kind !== "rules") where[e.id] = { pack: "lore", entryId: stableId("lore", e.id) };
  return where;
}

/** [[id|label]] -> a Foundry link to wherever that entry lives in the packs. Unknown ids become plain text. */
export function packLinks(html, byId, where) {
  return html.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, id, label) => {
    const at = where[id];
    const text = label || escapeHtml(byId[id]?.name ?? id);
    if (!at) return text;
    const uuid = at.pageId
      ? `Compendium.${SYSTEM_ID}.${at.pack}.JournalEntry.${at.entryId}.JournalEntryPage.${at.pageId}`
      : `Compendium.${SYSTEM_ID}.${at.pack}.JournalEntry.${at.entryId}`;
    return `@UUID[${uuid}]{${text}}`;
  });
}

/** One Ledger entry as page HTML: its tag, its summary, then its body. */
function entryHtml(e, byId, where) {
  const lead = [
    e.tag ? `<p><em>${escapeHtml(e.tag)}</em></p>` : "",
    e.summary ? `<p><strong>${escapeHtml(e.summary)}</strong></p>` : ""
  ].join("");
  return lead + packLinks(paragraphs(e.body ?? []), byId, where);
}

/** Cantica: Rules. */
export function rulesPack({ entries, briefs, version }) {
  const byId = Object.fromEntries(entries.map(e => [e.id, e]));
  const where = locate(entries);
  const docs = [];
  const rules = entries.filter(e => e.kind === "rules");

  RULE_PARTS.forEach((part, i) => {
    const entryId = stableId("rules", part.key);
    const ids = part.skills ? rules.filter(e => e.id.startsWith("skill-")).map(e => e.id) : part.entries;
    const pages = ids.filter(id => byId[id]).map((id, n) => page(entryId, {
      id: where[id].pageId, name: byId[id].name, content: entryHtml(byId[id], byId, where), sort: (n + 1) * 100000
    }));
    docs.push(journalEntry({ id: entryId, name: `${i + 1}. ${part.name}`, sort: (i + 1) * 100000, pages, version }));
  });

  const extra = rules.filter(e => where[e.id].entryId === stableId("rules", "more"));
  if (extra.length) {
    const entryId = stableId("rules", "more");
    docs.push(journalEntry({
      id: entryId, name: `${RULE_PARTS.length + 1}. More rules`, sort: (RULE_PARTS.length + 1) * 100000, version,
      pages: extra.map((e, n) => page(entryId, { id: where[e.id].pageId, name: e.name, content: entryHtml(e, byId, where), sort: (n + 1) * 100000 }))
    }));
  }

  // The Station Briefs: one page each, after the rules.
  if (briefs?.length) {
    const entryId = stableId("rules", "station-briefs");
    const label = { athletics: "Athletics" };
    const skillName = k => label[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
    const pages = briefs.map((b, n) => {
      const skills = Object.entries(b.skills).filter(([, r]) => r > 0).sort((a, c) => c[1] - a[1]).map(([k, r]) => `${skillName(k)} ${r}`).join(" · ");
      const content = [
        b.greeting ? `<blockquote><p>${escapeHtml(b.greeting)}</p></blockquote>` : "",
        `<p><strong>${escapeHtml(b.tagline ?? "")}</strong> ${escapeHtml(b.blurb ?? "")}</p>`,
        `<ul><li><strong>Suggested skills:</strong> ${escapeHtml(skills)}</li>`,
        `<li><strong>Sample Traits:</strong> ${(b.traits ?? []).map(t => `<em>${escapeHtml(t)}</em>`).join(" · ")}</li>`,
        `<li><strong>Sample Hindrances:</strong> ${(b.hindrances ?? []).map(t => `<em>${escapeHtml(t)}</em>`).join(" · ")}</li>`,
        b.gift ? `<li><strong>If you're Touched:</strong> <em>${escapeHtml(b.gift)}</em> / <em>${escapeHtml(b.drawback ?? "")}</em></li>` : "",
        b.shine ? `<li><strong>You shine when:</strong> ${escapeHtml(b.shine)}.</li>` : "",
        b.commendation ? `<li><strong>A first Commendation:</strong> <em>${escapeHtml(b.commendation.name)}:</em> ${escapeHtml(b.commendation.situation)}, ${escapeHtml(b.commendation.effect)}.</li>` : "",
        `</ul>`
      ].join("");
      return page(entryId, { id: stableId("brief", b.id), name: b.name, content, sort: (n + 1) * 100000 });
    });
    const intro = byId["rules-station-briefs"];
    if (intro) pages.unshift(page(entryId, { id: stableId("brief", "intro"), name: "Using a Brief", content: packLinks(paragraphs(intro.body), byId, where), sort: 0 }));
    docs.push(journalEntry({ id: entryId, name: "Station Briefs", sort: 9000000, pages, version }));
  }
  return docs;
}

/** Cantica: Lore. Folders by kind, one entry per person, place and so on. */
export function lorePack({ entries, kinds, version }) {
  const byId = Object.fromEntries(entries.map(e => [e.id, e]));
  const where = locate(entries);
  const docs = [];
  const lore = kinds.filter(k => k.id !== "rules");
  lore.forEach((kind, i) => {
    const folderId = stableId("lore-folder", kind.id);
    docs.push(folderDoc({ id: folderId, name: kind.label, type: "JournalEntry", sort: (i + 1) * 100000 }));
    entries.filter(e => e.kind === kind.id).forEach((e, n) => {
      const entryId = where[e.id].entryId;
      docs.push(journalEntry({
        id: entryId, name: e.name, folder: folderId, sort: (n + 1) * 100000, version,
        pages: [page(entryId, { id: stableId("lore-page", e.id), name: e.name, content: entryHtml(e, byId, where), sort: 100000 })]
      }));
    });
  });
  return docs;
}

/**
 * One scenario as an Adventure: its NPCs (hidden from players), its Scene Cards, and its GM notes (hidden), in folders.
 * Importing it in Foundry creates them all; importing it again offers to update them.
 */
export function adventureDoc(scenario, version) {
  const id = stableId("adventure", scenario.id);
  const actorFolder = stableId("adventure-folder", scenario.id, "actors");
  const peopleFolder = stableId("adventure-folder", scenario.id, "people");
  const placesFolder = stableId("adventure-folder", scenario.id, "places");
  const journalFolder = stableId("adventure-folder", scenario.id, "journal");
  const flags = key => ({ [SYSTEM_ID]: { scenarioKey: `${scenario.id}:${key}` } });

  const npcs = scenario.npcs.map((npc, n) => ({
    _id: stableId("adventure-actor", scenario.id, npc.key),
    name: npc.name, type: "npc", img: DEFAULT_NPC_IMG, folder: peopleFolder, sort: (n + 1) * 100000,
    system: { rating: npc.rating, tier: npc.tier, ...splitTags(npc.tags, npc.action ?? 1), notes: npc.notes ?? "" },
    prototypeToken: { name: npc.name, texture: { src: DEFAULT_NPC_IMG } },
    items: [], effects: [], ownership: { default: NONE }, flags: flags(npc.key), _stats: stats(version)
  }));

  const cards = scenario.places.map((place, n) => ({
    _id: stableId("adventure-actor", scenario.id, place.key),
    name: place.name, type: "card", img: DEFAULT_CARD_IMG, folder: placesFolder, sort: (n + 1) * 100000,
    system: {
      description: place.description ?? "",
      traits: place.traits.map(name => ({ id: stableId("adventure-trait", scenario.id, place.key, name), name, note: "" }))
    },
    prototypeToken: { name: place.name, texture: { src: DEFAULT_CARD_IMG } },
    items: [], effects: [], ownership: { default: OBSERVER }, flags: flags(place.key), _stats: stats(version)
  }));

  const notesId = stableId("adventure-journal", scenario.id);
  const notes = {
    _id: notesId, name: `${scenario.name}: GM notes`, folder: journalFolder, sort: 0,
    pages: scenario.journal.map((p, n) => ({
      _id: stableId("adventure-page", scenario.id, p.name), name: p.name, type: "text", sort: (n + 1) * 100000,
      title: { show: true, level: 1 }, text: { format: HTML, content: p.html }, ownership: { default: INHERIT }, flags: {}
    })),
    ownership: { default: NONE }, flags: { [SYSTEM_ID]: { scenario: scenario.id } }, _stats: stats(version)
  };

  const folders = [
    folderDoc({ id: actorFolder, name: scenario.name, type: "Actor", key: false }),
    folderDoc({ id: peopleFolder, name: "People", type: "Actor", parent: actorFolder, sort: 100000, key: false }),
    folderDoc({ id: placesFolder, name: "Places", type: "Actor", parent: actorFolder, sort: 200000, key: false }),
    folderDoc({ id: journalFolder, name: scenario.name, type: "JournalEntry", key: false })
  ];

  return {
    _id: id, _key: `!adventures!${id}`,
    name: scenario.name, img: ADVENTURE_IMG,
    caption: scenario.caption ?? "",
    description: scenario.description ?? scenario.journal[0]?.html ?? "",
    actors: [...npcs, ...cards], journal: [notes], folders,
    items: [], scenes: [], tables: [], macros: [], cards: [], playlists: [], combats: [],
    sort: 0, flags: {}, _stats: stats(version)
  };
}

/** Cantica: One-Shots. */
export const oneShotsPack = ({ scenarios, version }) => scenarios.map(s => adventureDoc(s, version));
