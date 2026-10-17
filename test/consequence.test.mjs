import { test } from "node:test";
import assert from "node:assert/strict";
import { consequence, ROLL_MODES } from "../module/consequence.mjs";
import { cardView } from "../module/roll-card.mjs";
import { evaluateRoll } from "../module/rules.mjs";
import fs from "node:fs";

const lang = JSON.parse(fs.readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
const TIERS = ["denied", "conditions", "approved", "commended"];

test("acting and resisting have a line for every result, as the spec's tables give", () => {
  for (const mode of ["act", "resist"]) {
    for (const tier of TIERS) {
      const c = consequence(mode, tier);
      assert.ok(lang.CANTICA.Consequence[mode][tier], `${mode}.${tier} has words`);
      assert.equal(c.key, `${mode}.${tier}`);
    }
  }
});

test("a Request for Record answers one question per success", () => {
  assert.deepEqual(consequence("record", "denied", 0), { key: "record.none", data: { n: 0 } });
  assert.deepEqual(consequence("record", "conditions", 1), { key: "record.one", data: { n: 1 } });
  assert.deepEqual(consequence("record", "commended", 3), { key: "record.many", data: { n: 3 } });
  for (const k of ["none", "one", "many"]) assert.ok(lang.CANTICA.Consequence.record[k]);
});

test("an ordinary roll has no extra line", () => {
  assert.equal(consequence("plain", "approved"), null);
  assert.deepEqual(ROLL_MODES, ["plain", "act", "resist", "record"]);
});

test("the card shows the line for the result it shows now (after a Complication)", () => {
  const t = (key, data) => (data ? `${key}:${JSON.stringify(data)}` : key);
  const state = {
    actorId: "a", actorName: "Ilse", skillLabel: "Persuade", difficulty: 1, difficultyText: "D1", sceneId: "s", sceneName: "",
    factors: [], notes: [], hindranceNote: "", mode: "act",
    dice: [{ kind: "margin", value: 8, success: true }, { kind: "white", value: 9, success: true }],
    outcome: evaluateRoll({ margin: 8, white: [9] }, { difficulty: 1 }), upgradeConditions: false,
    dissonanceLabel: "", stampNote: false, complication: null, targetName: "Halvard", extra: [], refiled: false, refileGain: 0, ratingRaise: 0, log: []
  };
  assert.equal(cardView(state, t).consequence, "CANTICA.Consequence.act.approved");
  const complicated = cardView({ ...state, complication: { trait: "Steam", negated: false } }, t);
  assert.equal(complicated.consequence, "CANTICA.Consequence.act.conditions");
  assert.equal(cardView({ ...state, mode: "plain" }, t).consequence, "");
});
