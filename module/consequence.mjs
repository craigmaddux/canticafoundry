/**
 * What a result means, for the kinds of roll the rules give a table for. Pure, no Foundry dependency, so it is
 * unit-tested in Node (see test/consequence.test.mjs).
 *
 *   act     acting against an NPC (their Rating is the Difficulty)
 *   resist  resisting an NPC, or a hazard (a fall, a toxic atmosphere: the GM gives it a Rating)
 *   record  a Request for Record: each success is one question Chorus answers, true, exact and literal
 *   plain   any other roll: the result tier says it all
 */

export const ROLL_MODES = ["plain", "act", "resist", "record"];

/**
 * @param {string} mode   One of ROLL_MODES.
 * @param {string} tier   denied | conditions | approved | commended
 * @param {number} successes
 * @returns {{key: string, data?: object}|null}  A language key under CANTICA.Consequence, or null for none.
 */
export function consequence(mode, tier, successes = 0) {
  if (mode === "act") return { key: `act.${tier}` };
  if (mode === "resist") return { key: `resist.${tier}` };
  if (mode === "record") {
    const n = Math.max(0, Math.trunc(Number(successes) || 0));
    return { key: n === 0 ? "record.none" : n === 1 ? "record.one" : "record.many", data: { n } };
  }
  return null;
}
