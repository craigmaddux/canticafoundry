/**
 * Run changes one after another. A world setting or a document read straight after a write still shows the old
 * value until the server answers, so two "+1"s that run side by side both read the same number and add 1, not 2.
 * Queued, each change starts only when the one before it has finished.
 */
export function serial() {
  let tail = Promise.resolve();
  return fn => {
    const run = tail.then(fn, fn);
    tail = run.catch(error => console.error("cantica |", error));
    return run;
  };
}
