import { spyOn } from "bun:test";

type Answer = number | object;

// Replaces fetch for one test, so no test ever reaches the network. Each URL
// path answers a status code or a JSON body, or a function of the full URL
// when the query string matters; any other call fails the test.
// Undo with `mock.restore()` from bun:test, usually in afterEach.
export function fakeFetch(answers: Record<string, Answer | ((url: URL) => Answer)>) {
  const fakeFetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const entry = answers[url.pathname];
    if (entry === undefined) throw new Error(`unexpected fetch: ${url.pathname}`);
    const answer = typeof entry === "function" ? entry(url) : entry;
    if (typeof answer === "number") return new Response("{}", { status: answer });
    return Response.json(answer);
  };
  // Bun's fetch type also carries `preconnect`, which a fake does not need.
  return spyOn(globalThis, "fetch").mockImplementation(fakeFetch as typeof fetch);
}
