/**
 * Scene Cards: pure helpers with no Foundry dependency, unit-tested in Node.
 *
 * A Scene Card is a place on the tabletop. Its Traits are just Traits: short phrases about the
 * place (Steam Everywhere, A Spare Coupling in the Locker). They do two things:
 *   1. A roller may pick ONE of them in the roll dialog, for +1 die.
 *   2. The GM may spend Scrutiny on one after a roll: one success fewer, which the player can
 *      negate by spending a Stamp.
 * A character is "in" a card when their token sits on it.
 *
 * Locations and Sections: when the space matters, each Section is a card of its own, "part of" the card for the whole
 * Location (and that may be part of a bigger one: zoom in as far as you need). Put the Section cards on top of the
 * Location's; a token is on the smallest card under it. A roll there may use one scene Trait from the Section or
 * from any place it is part of.
 */

/** A scene Trait picked in the roll dialog adds this many dice. Only one may be picked. */
export const SCENE_TRAIT_DICE = 1;

/** Is the point inside the rectangle (edges included)? */
export function containsPoint(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.w
    && point.y >= rect.y && point.y <= rect.y + rect.h;
}

/**
 * Which card is a point on? When cards overlap, the smallest one wins (it is the
 * more specific place); equal sizes fall to the one drawn on top (higher sort).
 * @param {{x: number, y: number}} point  Usually the center of the character's token.
 * @param {{id: string, x: number, y: number, w: number, h: number, sort?: number}[]} cards
 * @returns {string|null} the card's id
 */
export function pickCard(point, cards) {
  const hits = cards.filter(card => containsPoint(card, point));
  if (!hits.length) return null;
  hits.sort((a, b) => (a.w * a.h) - (b.w * b.h) || (b.sort ?? 0) - (a.sort ?? 0));
  return hits[0].id;
}

/** A new scene Trait: a phrase, and an optional note on how it plays. */
export function newTrait({ id, name = "", note = "" } = {}) {
  return { id, name: String(name).trim(), note: String(note).trim() };
}

/**
 * The places a card is part of, nearest first: its Location, that Location's, and so on. Stops at a missing card or a
 * loop (a card can't be part of itself, however the links are set).
 * @param {{id: string, system: {location?: string}}} card
 * @param {(id: string) => object|null|undefined} lookup  Finds a card by id.
 * @returns {object[]}
 */
export function locationsOf(card, lookup) {
  const chain = [];
  const seen = new Set([card?.id]);
  let next = card?.system?.location;
  while (next && !seen.has(next)) {
    const parent = lookup(next);
    if (!parent) break;
    chain.push(parent);
    seen.add(parent.id);
    next = parent.system?.location;
  }
  return chain;
}

/**
 * Cards that may be chosen as the place a card is part of: any other card, except one that is (however far down)
 * part of this card, which would make a loop.
 */
export function locationOptions(card, cards, lookup) {
  return cards.filter(other => other.id !== card.id && !locationsOf(other, lookup).some(c => c.id === card.id));
}

/**
 * The scene Traits a roll on a card may use: the card's own, then each place it is part of, nearest first.
 * @returns {{cardId: string, name: string, own: boolean, traits: object[]}[]}  Groups with at least one named Trait.
 */
export function traitGroups(card, lookup) {
  return [card, ...locationsOf(card, lookup)]
    .map((c, i) => ({ cardId: c.id, name: c.name, own: i === 0, traits: (c.system?.traits ?? []).filter(t => t?.name) }))
    .filter(group => group.traits.length);
}

/** Dice a chosen scene Trait contributes (none if nothing is chosen). */
export const sceneTraitDice = chosen => (chosen ? SCENE_TRAIT_DICE : 0);

/**
 * Of the scene Traits ticked in the dialog, only the first counts: only one scene Trait
 * can be added to a roll.
 */
export const firstScene = picks => (Array.isArray(picks) ? picks[0] ?? null : picks ?? null);
