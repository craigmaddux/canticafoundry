import { test } from "node:test";
import assert from "node:assert/strict";
import { serial } from "../module/serial.mjs";

test("queued changes run one after another, so read-then-write changes all count", async () => {
  const queue = serial();
  let value = 0;
  const slowAdd = n => queue(async () => {
    const read = value;
    await new Promise(r => setTimeout(r, 5));
    value = read + n;
  });
  await Promise.all([slowAdd(1), slowAdd(1), slowAdd(1)]);
  assert.equal(value, 3);
});

test("a failed change doesn't stop the ones after it", async () => {
  const queue = serial();
  const results = await Promise.allSettled([queue(() => { throw new Error("no"); }), queue(() => "yes")]);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].value, "yes");
});
