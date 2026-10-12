// One JSON line per event, on stdout, read in the Umbrel app's logs.
// Never put a secret, an image or a sound in `fields`.
// Silent under `bun test`, which sets NODE_ENV to "test".
export function log(fields: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.log(JSON.stringify({ time: new Date().toISOString(), ...fields }));
}

// Runs one step of a Share's Identification and logs it once it ends: its
// duration, what `describe` says of the result, or the error (then rethrown).
export async function step<Result>(
  shareId: string,
  name: string,
  work: () => Promise<Result>,
  describe: (result: Result) => Record<string, unknown> = () => ({}),
): Promise<Result> {
  const started = performance.now();
  const durationMs = () => Math.round(performance.now() - started);
  try {
    const result = await work();
    log({ shareId, step: name, durationMs: durationMs(), ...describe(result) });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log({ shareId, step: name, durationMs: durationMs(), error: message });
    throw error;
  }
}
