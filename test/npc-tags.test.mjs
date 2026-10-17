import { test } from "node:test";
import assert from "node:assert/strict";
import { splitTags, migrateNpcTags, tagsOf } from "../module/npc-tags.mjs";

test("the old Action Tag becomes the Role Tag; the rest are the other Tags", () => {
  assert.deepEqual(splitTags(["Has the Permit", "Means Well", "Believes Every Word"], 1),
    { roleTag: "Has the Permit", otherTag1: "Means Well", otherTag2: "Believes Every Word" });
  assert.deepEqual(splitTags(["Crack Shot", "Silver Tongue", ""], 2), { roleTag: "Silver Tongue", otherTag1: "Crack Shot", otherTag2: "" });
  assert.deepEqual(splitTags([], 1), { roleTag: "", otherTag1: "", otherTag2: "" });
});

test("migration fills only what is missing, so it is stable however often it runs", () => {
  const stored = { tag1: "Loud", tag2: "Has a Petition", tag3: "", actionTag: 1 };
  migrateNpcTags(stored);
  assert.deepEqual([stored.roleTag, stored.otherTag1], ["Loud", "Has a Petition"]);
  // An edit to one new field after migration survives the next run.
  const edited = { tag1: "Loud", tag2: "Has a Petition", actionTag: 1, otherTag1: "Hoarse" };
  migrateNpcTags(edited);
  assert.deepEqual([edited.roleTag, edited.otherTag1], ["Loud", "Hoarse"]);
  // Already on the Role Tag: untouched.
  const fresh = { roleTag: "Veteran Proctor", otherTag1: "" };
  assert.deepEqual(migrateNpcTags({ ...fresh }), fresh);
});

test("the tier decides how many other Tags are in play", () => {
  const sys = { roleTag: "Sump Toughs", otherTag1: "Numbers", otherTag2: "Mean" };
  assert.deepEqual(tagsOf({ ...sys, tier: "background" }), ["Sump Toughs"]);
  assert.deepEqual(tagsOf({ ...sys, tier: "minor" }), ["Sump Toughs", "Numbers"]);
  assert.deepEqual(tagsOf({ ...sys, tier: "major" }), ["Sump Toughs", "Numbers", "Mean"]);
});
