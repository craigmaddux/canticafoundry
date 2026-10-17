/** Static Cantica configuration: skills, groups, Traits and tiers. */

export const SYSTEM_ID = "cantica";

/**
 * The 16 skills, grouped (spec v0.12). Labels and hints live in lang/en.json under CANTICA.Skill.<key>.
 * There is no skill for the Bound: Hullcraft fixes their machines, Lore's rites calm them, Persuade talks with the
 * ones that talk, Composure holds steady against them, and hearing them takes a Gift.
 */
export const SKILL_GROUPS = {
  body: ["athletics", "scuffle", "sneak", "aim"],
  mind: ["lore", "science", "notice", "composure", "systems"],
  hands: ["hullcraft", "mend", "pilot"],
  people: ["persuade", "procedure"],
  worlds: ["survival", "navigate"]
};

/** Skills that were retired, and the skill that takes over the rating (Attune became Composure in v0.12). */
export const RETIRED_SKILLS = { attune: "composure" };

export const SKILLS = Object.values(SKILL_GROUPS).flat();

export const SKILL_MAX = 2;

/** Standard starting spread: three skills at 2, three at 1, the other ten at 0 (15 Tenure). */
export const STARTING_SPREAD = { 2: 3, 1: 3, 0: 10 };

/** Station is required; the open Traits are free text. A character starts with two and can buy up to six. Station and every open Trait carry a rank (1-2). */
export const OPEN_TRAITS = ["trait1", "trait2", "trait3", "trait4", "trait5", "trait6"];

/** The two Encumbrances every character has. Neither ever adds a die. */
export const ENCUMBRANCES = ["personal", "circumstantial"];

/**
 * How many grid squares a Scene Card's token covers. v0.8.1 made them three times as wide and as tall
 * (12 x 9, up from 4 x 3), so the card reads at a glance on the tabletop.
 */
export const CARD_TOKEN = { width: 12, height: 9 };
export const OLD_CARD_TOKEN = { width: 4, height: 3 };

/** NPC tiers: how much of the Notice track they have. */
export const NPC_TIERS = ["background", "minor", "major"];

export const TIERS = ["denied", "conditions", "approved", "commended"];

/** Kinds of History log entry. */
export const HISTORY_KINDS = ["earned", "spent", "compline", "note"];
