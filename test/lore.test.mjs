import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { toPlain, unlink, entryText, paragraphs } from "../module/lore-text.mjs";

// Load the real ledger data, exactly as the website and the system do.
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../lore-src/ledger-data.js", import.meta.url), "utf8"), ctx);
const entries = ctx.window.LEDGER;
const kinds = ctx.window.LEDGER_KINDS.map(k => k.id);
const byId = Object.fromEntries(entries.map(e => [e.id, e]));

test("the ledger data is well formed: unique ids, every link resolves", () => {
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  for (const e of entries) {
    assert.ok(kinds.includes(e.kind), `${e.id} kind`);
    for (const p of e.body) for (const m of p.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) assert.ok(byId[m[1]], `${e.id} links to unknown ${m[1]}`);
  }
});

test("every person and place has what the People & Places pack needs", () => {
  const people = entries.filter(e => e.kind === "people");
  const places = entries.filter(e => e.kind === "places");
  assert.ok(people.length >= 13 && places.length >= 13);
  for (const e of [...people, ...places]) {
    assert.ok(e.name && e.summary, e.id);
    assert.ok(toPlain(paragraphs(e.body), byId).length > 20, `${e.id} has body text`);
  }
});

test("links become labels in plain text", () => {
  assert.equal(unlink("See [[chorus|Chorus]] and [[the-bound]].", byId), "See Chorus and The Bound.");
});

test("plain text keeps lists and paragraphs readable", () => {
  const text = toPlain("<p>One &amp; two.</p><ul><li>First</li><li>Second</li></ul><p>End.</p>");
  assert.equal(text, "One & two.\n\n• First\n• Second\n\nEnd.");
});

test("entryText leads with the summary", () => {
  const e = byId["tamsin-voy"];
  const text = entryText(e, byId);
  assert.ok(text.startsWith(e.summary));
  assert.ok(text.includes("Retirement Society"));
  assert.ok(!text.includes("[["));
});

