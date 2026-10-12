import { spyOn } from "bun:test";

// Replaces fetch for one test, so no test ever reaches the network. Each URL
// path answers a status code or a JSON body; any other call fails the test.
// Undo with `mock.restore()` from bun:test, usually in afterEach.
export function fakeFetch(answers: Record<string, number | object>) {
  const fakeFetch = async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    const answer = answers[path];
    if (answer === undefined) throw new Error(`unexpected fetch: ${path}`);
    if (typeof answer === "number") return new Response("{}", { status: answer });
    return Response.json(answer);
  };
  // Bun's fetch type also carries `preconnect`, which a fake does not need.
  return spyOn(globalThis, "fetch").mockImplementation(fakeFetch as typeof fetch);
}
