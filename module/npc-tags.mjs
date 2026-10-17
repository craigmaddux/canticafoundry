/**
 * NPC Tags (spec v0.11). Pure functions, unit-tested in Node.
 *
 * Stat block: Name · Rating · Tier · Role Tag · other Tags. The Role Tag is who the NPC is (Veteran Proctor,
 * Liturgist Cantor); the other Tags are what else they're good at. A Background NPC has its Role Tag only, a Minor
 * one other Tag, a Major two. Whichever Tag applies, the player loses a die, and only one Tag applies to any roll.
 */

/** How many other Tags each tier carries, besides the Role Tag. */
export const OTHER_TAGS = { background: 0, minor: 1, major: 2 };

/**
 * From a list of Tags and which was the old Action Tag (1-3): the Role Tag and the others, in order.
 * @param {string[]} tags
 * @param {number} [action=1]
 * @returns {{roleTag: string, otherTag1: string, otherTag2: string}}
 */
export function splitTags(tags = [], action = 1) {
  const list = tags.map(t => (t ?? "").trim());
  const index = Math.min(Math.max(1, Number(action) || 1), Math.max(1, list.length)) - 1;
  const roleTag = list[index] ?? "";
  const others = list.filter((t, i) => i !== index && t);
  return { roleTag, otherTag1: others[0] ?? "", otherTag2: others[1] ?? "" };
}

/**
 * Bring a stored NPC up to the Role Tag (v0.10's tag1-tag3 and Action Tag). Each new field is filled only while it is
 * missing from the stored data, so it gives the same answer every time it runs, whatever has been edited since.
 * @param {object} source  The NPC's system data, as stored.
 * @returns {object}  The same object.
 */
export function migrateNpcTags(source) {
  if (!source || typeof source !== "object") return source;
  const old = ["tag1", "tag2", "tag3"].some(key => typeof source[key] === "string");
  if (!old) return source;
  const split = splitTags([source.tag1, source.tag2, source.tag3], source.actionTag);
  for (const key of ["roleTag", "otherTag1", "otherTag2"]) {
    if (source[key] === undefined) source[key] = split[key];
  }
  return source;
}

/** The Tags in play on an NPC, Role Tag first: only as many others as the tier carries. */
export function tagsOf(system) {
  const count = OTHER_TAGS[system?.tier] ?? 2;
  return [system?.roleTag, system?.otherTag1, system?.otherTag2].slice(0, 1 + count).filter(Boolean);
}
