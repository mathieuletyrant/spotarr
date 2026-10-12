import { spyOn } from "bun:test";

// Replaces fetch for one test, so no test ever reaches the real TMDB. Each
// path answers its body (as JSON) or its status code; any other call fails the
// test. Undo with `mock.restore()` from bun:test, usually in afterEach.
export function fakeTmdb(answers: Record<string, object | number>) {
  const fakeFetch = async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const answer = answers[path];
    if (answer === undefined) throw new Error(`unexpected TMDB call: ${path}`);
    if (typeof answer === "number") return new Response("{}", { status: answer });
    return Response.json(answer);
  };
  // Bun's fetch type also carries `preconnect`, which a fake does not need.
  return spyOn(globalThis, "fetch").mockImplementation(fakeFetch as typeof fetch);
}
