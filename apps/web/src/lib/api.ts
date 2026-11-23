import { Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { QueryCache, QueryClient, type QueryMeta } from "@tanstack/react-query";

// The API answers on the same origin, under /api. The HttpOnly cookie set at
// login rides along with every call: the page never sees the token.
// The cast: Bun's types add `fetch.preconnect`, which the browser has no use for.
export const transport = createConnectTransport({
  baseUrl: "/api",
  fetch: fetchThroughAuthProxy as typeof fetch,
});

// Spotarr's API never redirects: a redirect comes from an auth proxy in front of
// Spotarr (Cloudflare Access, Authelia…) asking to sign in again, once its
// session has ended. The page's own fetch cannot follow it to another domain,
// so the page reloads and the browser follows it to the sign-in.
async function fetchThroughAuthProxy(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, { ...init, redirect: "manual" });
  if (response.type === "opaqueredirect") reloadForSignIn();
  return response;
}

// At most once a minute, so a sign-in that keeps failing cannot loop.
function reloadForSignIn() {
  const key = "spotarr:sign-in-reload";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last < 60_000) return;
  sessionStorage.setItem(key, String(Date.now()));
  window.location.reload();
}

// The session ended while using the app (a new API token, say): back to the
// login page. The sign-in check of routes/_app.tsx redirects on its own, so
// its query is marked `meta: { signInCheck: true }` and left alone here.
function toLoginWhenUnauthenticated(error: unknown, query: { meta?: QueryMeta }) {
  const unauthenticated = ConnectError.from(error).code === Code.Unauthenticated;
  if (unauthenticated && !query.meta?.signInCheck) window.location.assign("/login");
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: toLoginWhenUnauthenticated }),
  defaultOptions: { queries: { retry: 1 } },
});
