import { test } from "node:test";
import assert from "node:assert/strict";
import { tokensOf } from "../module/card-art.mjs";

// Foundry's collections have no flatMap: they offer their documents as an array in `contents`.
// A stand-in with exactly that shape, so reaching for flatMap on one would throw here as it does in Foundry.
const collection = items => ({ contents: items, filter: fn => items.filter(fn) });

test("a card's tokens are found on every scene, through the collections' arrays", () => {
  globalThis.game = {
    scenes: collection([
      { tokens: collection([{ id: "t1", actorId: "card-1" }, { id: "t2", actorId: "someone" }]) },
      { tokens: collection([{ id: "t3", actorId: "card-1" }]) },
      { tokens: collection([]) }
    ])
  };
  assert.deepEqual(tokensOf({ id: "card-1" }).map(t => t.id), ["t1", "t3"]);
  assert.deepEqual(tokensOf({ id: "nobody" }), []);
  delete globalThis.game;
});
