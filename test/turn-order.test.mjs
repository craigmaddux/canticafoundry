import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRoll, withoutMarginEffects } from "../module/rules.mjs";
import { cardView } from "../module/roll-card.mjs";

const t = key => key;
const state = (over = {}) => ({
  actorId: "a", actorName: "Ilse", skillLabel: "Notice", difficulty: 0, difficultyText: "D0", sceneId: "scene", sceneName: "Engine Room",
  factors: [], notes: [], hindranceNote: "",
  dice: [{ kind: "margin", value: 10, success: true }, { kind: "white", value: 3, success: false }, { kind: "white", value: 9, success: true }],
  outcome: withoutMarginEffects(evaluateRoll({ margin: 10, white: [3, 9] }, { difficulty: 0 })), upgradeConditions: false,
  dissonanceLabel: "", stampNote: false, complication: null, targetName: "", extra: [], refiled: false, refileGain: 0, countersigned: [], ratingRaise: 0, log: [],
  ...over
});

test("a turn-order card is a count of successes: no verdict, and nothing to do to it afterwards", () => {
  const view = cardView(state({ turnOrder: true }), t);
  assert.equal(view.turnOrder, true);
  assert.equal(view.successes, 2);
  assert.equal(view.canRefile, false);
  assert.equal(view.canComplicate, false);
  assert.equal(view.canRaise, false);
});

test("an ordinary card still offers Refile and Complicate", () => {
  const view = cardView(state(), t);
  assert.equal(view.turnOrder, false);
  assert.equal(view.canRefile, true);
  assert.equal(view.canComplicate, true);
});

test("the Margin's Grace doesn't count on a turn-order roll, but its success does", () => {
  const o = state({ turnOrder: true }).outcome;
  assert.equal(o.grace, false);
  assert.equal(o.successes, 2);
});
