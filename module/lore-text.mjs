/**
 * Text helpers for the lore (lore-src/ledger-data.js): turning entry bodies into HTML or plain text for the compendium
 * packs, and escaping. Pure functions with no Foundry dependency, unit-tested in Node against the real data.
 *
 * Entry bodies are authored HTML. A string starting with "<" is inserted as-is; anything else
 * is wrapped in <p>. [[id]] or [[id|label]] links to another entry.
 */

const LINK = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;


export const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Wrap bare paragraphs in <p>; leave authored blocks (tables, lists) alone. */
export const paragraphs = body => body.map(p => (p.charAt(0) === "<" ? p : `<p>${p}</p>`)).join("");


/** [[id|label]] -> just the label, for chat and notes. */
export function unlink(html, byId) {
  return html.replace(LINK, (m, id, label) => label || byId[id]?.name || id);
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&mdash;": "—" };

/** HTML to readable plain text: paragraphs and list items on their own lines. */
export function toPlain(html, byId = {}) {
  return unlink(html, byId)
    .replace(/<\/(p|ul|ol|table|div|blockquote)>/gi, "\n\n")
    .replace(/<\/(li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/t[dh]>/gi, " · ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, e => ENTITIES[e] ?? e)
    .replace(/ · \n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The whole entry as plain text: its summary, then its body. */
export function entryText(entry, byId = {}) {
  return [entry.summary, toPlain(paragraphs(entry.body), byId)].filter(Boolean).join("\n\n");
}
