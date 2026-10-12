import { Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { QueryCache, QueryClient } from "@tanstack/react-query";

// The API answers on the same origin, under /api. The HttpOnly cookie set at
// login rides along with every call: the page never sees the token.
export const transport = createConnectTransport({ baseUrl: "/api" });

// No token yet, or a wrong one: send the user to the login page.
function toLoginWhenUnauthenticated(error: unknown) {
  const unauthenticated = ConnectError.from(error).code === Code.Unauthenticated;
  if (unauthenticated && window.location.pathname !== "/login") window.location.assign("/login");
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: toLoginWhenUnauthenticated }),
  defaultOptions: { queries: { retry: 1 } },
});
