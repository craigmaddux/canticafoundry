/**
 * Summary Proceedings: a quick scene resolved with one roll per player. The GM gives the situation a Rating
 * (a swarm of hull-mites: Rating 1). Each player describes an approach, picks a skill, and rolls once against it.
 * Each result is that player's part of the story. If at least half the group reaches Approved, the scene is won,
 * and the GM narrates it as a montage built from everyone's rolls.
 *
 * It lives on a Scene Card, in a panel only the GM sees. Pure functions with no Foundry dependency, so the logic
 * is unit-tested in Node (see test/proceedings.test.mjs).
 *
 * A proceedings is { open, name, rating, group, results: [{who, tier}] }.
 */

export const TIERS = ["commended", "approved", "conditions", "denied"];

/** What each result means for the player, as the spec's table gives it (the Ledger shows the words). */
export const STORY = {
  commended: "carry",        // you carry the moment, plus a bonus (find something, save someone)
  approved: "contribute",    // you contribute cleanly
  conditions: "price",       // you contribute, but take a Minor Notice
  denied: "slip"             // you take a Major, or the thing you were protecting slips
};

export const open = ({ name = "", rating = 1, group = 3 } = {}) =>
  ({ open: true, name, rating, group: Math.max(1, Math.trunc(Number(group)) || 1), results: [] });

/** Record a player's one roll. Rolling again replaces their result. Returns a new proceedings. */
export function record(p, who, tier) {
  if (!TIERS.includes(tier)) return p;
  const results = (p.results ?? []).filter(r => r.who !== who);
  return { ...p, results: [...results, { who, tier }] };
}

export const remove = (p, who) => ({ ...p, results: (p.results ?? []).filter(r => r.who !== who) });

/** Players whose result is Approved or better. */
export const approvedCount = p => (p.results ?? []).filter(r => r.tier === "approved" || r.tier === "commended").length;

export const rolled = p => (p.results ?? []).length;

/** The scene is won once at least half the group has reached Approved. */
export const isWon = p => p.group > 0 && approvedCount(p) * 2 >= p.group;

/** "won" as soon as half the group is Approved; "lost" once it can no longer happen; otherwise "open". */
export function status(p) {
  if (isWon(p)) return "won";
  const needed = Math.ceil(p.group / 2);
  const stillToRoll = Math.max(0, p.group - rolled(p));
  return approvedCount(p) + stillToRoll < needed ? "lost" : "open";
}
