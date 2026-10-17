/**
 * Station Briefs: player-facing primers for people who want help building a character with a
 * class-like feel. The data is station-briefs-data.js (written for the website and copied here by scripts/sync-lore.mjs) (window.STATION_BRIEFS, bundled into
 * the system with the lore), so the website and Register With Gloss read the same Briefs.
 *
 * A Brief is a starting point, not a class. Picking one fills in Station and the skills (the standard
 * spread, exactly the 15 creation Tenure) and offers its Traits, Hindrances and Gift as suggestions the
 * player can take, edit or ignore. Its Commendation is offered at Grade II. Pure functions with no
 * Foundry dependency apart from the data lookup, so they are unit-tested in Node.
 */

import { SKILLS } from "./config.mjs";

/** The Briefs. Empty when the lore has not been bundled (a development copy). */
export const loadBriefs = () => (typeof window !== "undefined" ? window.STATION_BRIEFS : null) ?? [];

export const findBrief = (id, list = loadBriefs()) => (id ? list.find(brief => brief.id === id) ?? null : null);

/** The Brief's skills as a full set: every skill, 0 where the Brief doesn't mention it. */
export const briefSkills = brief => Object.fromEntries(SKILLS.map(key => [key, brief.skills?.[key] ?? 0]));

/**
 * Which suggestions a Brief makes at a step (see registration-steps.mjs): "traits" (all three), or one of the
 * two Hindrances for its slot: "personal" is the first, "circumstantial" the second.
 */
export function suggestionsFor(kind, brief) {
  if (!brief) return [];
  if (kind === "traits") return brief.traits ?? [];
  if (kind === "personal") return brief.hindrances?.[0] ? [brief.hindrances[0]] : [];
  if (kind === "circumstantial") return brief.hindrances?.[1] ? [brief.hindrances[1]] : [];
  return [];
}

/**
 * Quick create: everything a Brief offers, as one update to a character in creation. Station is the Brief's name,
 * the two open Traits its first two sample Traits, its two Hindrances, and its skills. Touched is optional: with
 * touched, its Gift and Drawback too (unregistered, which is a fine Hindrance of its own); without, no Gift.
 * @param {object} brief
 * @param {{touched?: boolean}} [opts]
 * @returns {object}  An update object (dot paths).
 */
export function quickCreate(brief, { touched = false } = {}) {
  if (!brief) return {};
  const [trait1 = "", trait2 = ""] = brief.traits ?? [];
  const [personal = "", circumstantial = ""] = brief.hindrances ?? [];
  const update = {
    "system.brief": brief.id,
    "system.traits.station": brief.name,
    "system.traits.trait1": trait1,
    "system.traits.trait2": trait2,
    "system.encumbrances.personal": personal,
    "system.encumbrances.circumstantial": circumstantial,
    "system.skills": briefSkills(brief),
    "system.touched": Boolean(touched && brief.gift)
  };
  if (touched && brief.gift) Object.assign(update, { "system.gift": brief.gift, "system.drawback": brief.drawback ?? "" });
  return update;
}

/** The Brief's Gift and Drawback, as the first suggestion at the Touched step. */
export const giftFor = brief => (brief?.gift ? { gift: brief.gift, drawback: brief.drawback } : null);

/**
 * The Commendation a Brief suggests, shown once there is a slot for it. Nothing once the character
 * already has a Commendation of that name.
 * @param {object|null} brief
 * @param {{name: string}[]} existing  The character's Commendations.
 * @returns {{name: string, situation: string, effect: string, ruleBreak: string}|null}
 */
export function commendationSuggestion(brief, existing = []) {
  const c = brief?.commendation;
  if (!c) return null;
  if (existing.some(e => (e.name || "").trim().toLowerCase() === c.name.toLowerCase())) return null;
  return { name: c.name, situation: c.situation, effect: c.effect, ruleBreak: c.ruleBreak };
}
