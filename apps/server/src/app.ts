import { SpotarrService } from "@spotarr/contract";
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { requireMcpToken, requireSeerrToken, requireToken } from "./api/auth";
import { connectHandler } from "./api/connect";
import { serveFrame } from "./api/frames";
import { mcpHandler } from "./api/mcp/server";
import { authRpcs } from "./api/rpc/auth";
import { errorsToConnect } from "./api/rpc/errors";
import { ruleRpcs } from "./api/rpc/rules";
import { settingsRpcs } from "./api/rpc/settings";
import { shareRpcs } from "./api/rpc/shares";
import { statusRpcs } from "./api/rpc/status";
import { streamingRpcs } from "./api/rpc/streaming";
import { seerrWebhook } from "./api/seerr-webhook";
import type { RuleRepository } from "./domain/auto-add/repository";
import type { SettingsRepository } from "./domain/settings/repository";
import type { ShareRepository } from "./domain/shares/repository";
import { log } from "./log";

export type AppDeps = {
  apiToken: () => string;
  settings: SettingsRepository;
  shares: ShareRepository;
  rules: RuleRepository;
};

// Routes: GET /health (open), POST /api/* (Connect RPCs, token required but
// for Login), GET /frames/* (video thumbnails, token required), /mcp (the MCP
// server, MCP token required), POST /seerr/webhook (Seerr reporting a change,
// Seerr token required). index.ts adds the web UI after them.
// Each file in api/rpc/ implements the RPCs of one domain.
export function createApp({ apiToken, settings, shares, rules }: AppDeps): Hono {
  const rpc = connectHandler({ interceptors: [errorsToConnect] }, (router) =>
    router.service(SpotarrService, {
      ...authRpcs(apiToken),
      ...statusRpcs(settings, shares),
      ...settingsRpcs(settings),
      ...shareRpcs(shares, settings),
      ...ruleRpcs(rules, shares),
      ...streamingRpcs(settings),
    }),
  );

  const app = new Hono();

  // Errors outside the RPCs get the same JSON shape as Connect's. The MCP
  // transport throws HTTPExceptions that carry their own answer.
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    log({ step: "http", error: String(error) });
    return c.json({ code: "internal", message: String(error) }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));
  app.use("/api/*", logRequest);
  app.use("/api/*", requireToken(apiToken));
  app.post("/api/*", (c) => rpc(c, "/api"));
  app.use("/frames/*", requireToken(apiToken));
  app.get("/frames/:shareId/:file", serveFrame(shares));
  app.use("/mcp", logRequest);
  app.use(
    "/mcp",
    requireMcpToken(async () => (await settings.get()).access.mcpToken),
  );
  app.post("/mcp", mcpHandler(shares));
  // Stateless: no stream to open (GET), no session to end (DELETE).
  app.on(["GET", "DELETE"], "/mcp", (c) => c.body(null, 405, { Allow: "POST" }));
  app.use("/seerr/*", logRequest);
  app.use(
    "/seerr/*",
    requireSeerrToken(async () => (await settings.get()).access.seerrToken),
  );
  app.post("/seerr/webhook", seerrWebhook(shares, settings));

  return app;
}

// One line per API or MCP call, refused ones included: which path, its status,
// how long. The path only: /mcp's query carries the MCP token.
const logRequest: MiddlewareHandler = async (c, next) => {
  const started = performance.now();
  await next();
  const durationMs = Math.round(performance.now() - started);
  log({ step: "request", path: c.req.path, status: c.res.status, durationMs });
};
