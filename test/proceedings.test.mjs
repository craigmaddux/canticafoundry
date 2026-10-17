import { test } from "node:test";
import assert from "node:assert/strict";
import { open, record, remove, approvedCount, isWon, status, rolled, STORY } from "../module/proceedings.mjs";

test("each result has a part in the story, as the spec's table gives", () => {
  assert.deepEqual(Object.keys(STORY).sort(), ["approved", "commended", "conditions", "denied"]);
});

test("each player rolls once: rolling again replaces their result", () => {
  let p = open({ group: 3 });
  p = record(p, "Ilse", "denied");
  p = record(p, "Caddo", "approved");
  p = record(p, "Ilse", "commended");
  assert.equal(rolled(p), 2);
  assert.equal(p.results.find(r => r.who === "Ilse").tier, "commended");
  assert.equal(record(p, "Ilse", "nonsense"), p);
});

test("Approved and Commended both count; With Conditions and Denied don't", () => {
  let p = open({ group: 4 });
  for (const [who, tier] of [["a", "approved"], ["b", "commended"], ["c", "conditions"], ["d", "denied"]]) p = record(p, who, tier);
  assert.equal(approvedCount(p), 2);
});

test("the scene is won when at least half the group reaches Approved", () => {
  const roll = (group, tiers) => tiers.reduce((p, tier, i) => record(p, `p${i}`, tier), open({ group }));
  assert.equal(isWon(roll(4, ["approved", "commended"])), true);   // 2 of 4
  assert.equal(isWon(roll(4, ["approved", "denied", "denied"])), false);
  assert.equal(isWon(roll(3, ["approved", "approved"])), true);    // 2 of 3
  assert.equal(isWon(roll(3, ["approved"])), false);               // 1 of 3 is under half
  assert.equal(isWon(roll(2, ["commended"])), true);               // 1 of 2 is half
  assert.equal(isWon(roll(1, ["approved"])), true);
});

test("status: won early, lost once it can't be won, open meanwhile", () => {
  let p = open({ group: 4 });
  assert.equal(status(p), "open");
  p = record(record(p, "a", "denied"), "b", "conditions");
  assert.equal(status(p), "open");          // two still to roll, two needed
  p = record(p, "c", "denied");
  assert.equal(status(p), "lost");          // at most one more Approved
  let q = record(record(open({ group: 4 }), "a", "approved"), "b", "approved");
  assert.equal(status(q), "won");
});

test("removing a result takes it back", () => {
  const p = record(record(open({ group: 2 }), "a", "approved"), "b", "denied");
  assert.equal(rolled(remove(p, "a")), 1);
});
