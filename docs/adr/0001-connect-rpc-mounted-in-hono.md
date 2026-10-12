# Mount Connect-RPC inside Hono through a small hand-written adapter

The API is a Connect-RPC service generated from a Protobuf contract, but the HTTP server is Hono on Bun, because Hono also serves the web UI, the `/health` route and the auth middlewares (bearer token, Cloudflare Access JWT). Connect ships no official Hono integration, so a ~20-line adapter built on `createFetchHandler` from `@connectrpc/connect/protocol` mounts the service under `/api`. The alternative, running Connect's own Node/Bun server next to Hono, would mean two servers and two auth layers for one process. The adapter is a documented workaround: it is flagged in the code and in the README, and it is the one place to revisit if Connect ever publishes a Hono integration.

## Consequences

- Every RPC answers on `POST /api/spotarr.v1.SpotarrService/<Method>`, JSON by default, so the iOS Shortcut calls it like a plain HTTP API.
- Handlers are typed with `ServiceImpl<typeof SpotarrService>` (see `apps/server/src/api/rpc/types.ts`), so a renamed contract field breaks the build rather than production.
