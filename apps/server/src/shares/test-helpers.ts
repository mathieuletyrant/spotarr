// Waits until `check` returns true, polling every few milliseconds. For tests
// of background work, where there is nothing to await directly.
export async function until(check: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await Bun.sleep(5);
  }
}

// A promise you resolve from outside: lets a test decide when an Identification ends.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// An Identify that always ends without a match, for tests of the queue and the RPCs.
export const identifyNothing = async () => ({
  status: "NO_MATCH" as const,
  extractors: [],
  clues: {},
  candidates: [],
});
