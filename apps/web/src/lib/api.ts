import { Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { QueryCache, QueryClient, type QueryMeta } from "@tanstack/react-query";

// The API answers on the same origin, under /api. The HttpOnly cookie set at
// login rides along with every call: the page never sees the token.
export const transport = createConnectTransport({ baseUrl: "/api" });

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
