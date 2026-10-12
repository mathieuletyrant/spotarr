// Mounts Connect-RPC in Hono. Connect ships no Hono integration (see docs/adr/0001):
// we turn each RPC handler into a fetch handler and route by its URL path.
import type { ConnectRouter } from "@connectrpc/connect";
import { createConnectRouter } from "@connectrpc/connect";
import { createFetchHandler } from "@connectrpc/connect/protocol";
import type { Context } from "hono";

export function connectHandler(routes: (router: ConnectRouter) => void) {
  const router = createConnectRouter();
  routes(router);
  // e.g. "/spotarr.v1.SpotarrService/GetStatus" → its fetch handler
  const byPath = new Map(router.handlers.map((h) => [h.requestPath, createFetchHandler(h)]));

  return (c: Context, prefix: string) => {
    const path = new URL(c.req.url).pathname.slice(prefix.length);
    const handler = byPath.get(path);
    return handler ? handler(c.req.raw) : c.notFound();
  };
}
