import { SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import { requireToken } from "./api/auth";
import { connectHandler } from "./api/connect";
import { serveFrame } from "./api/frames";
import { authRpcs } from "./api/rpc/auth";
import { errorsToConnect } from "./api/rpc/errors";
import { ruleRpcs } from "./api/rpc/rules";
import { settingsRpcs } from "./api/rpc/settings";
import { shareRpcs } from "./api/rpc/shares";
import { statusRpcs } from "./api/rpc/status";
import { webhookRpcs } from "./api/rpc/webhooks";
import type { WebhookSender } from "./api/webhooks/sender";
import type { RuleRepository } from "./domain/auto-add/repository";
import type { SettingsRepository } from "./domain/settings/repository";
import type { ShareRepository } from "./domain/shares/repository";
import type { WebhookRepository } from "./domain/webhooks/repository";
import { log } from "./log";

export type AppDeps = {
  apiToken: () => string;
  settings: SettingsRepository;
  shares: ShareRepository;
  webhooks: WebhookRepository;
  rules: RuleRepository;
  sender: WebhookSender;
};

// Routes: GET /health (open), POST /api/* (Connect RPCs, token required but
// for Login), GET /frames/* (video thumbnails, token required). index.ts adds
// the web UI after them.
// Each file in api/rpc/ implements the RPCs of one domain.
export function createApp({ apiToken, settings, shares, webhooks, rules, sender }: AppDeps): Hono {
  const rpc = connectHandler({ interceptors: [errorsToConnect] }, (router) =>
    router.service(SpotarrService, {
      ...authRpcs(apiToken),
      ...statusRpcs(settings, shares),
      ...settingsRpcs(settings),
      ...shareRpcs(shares, settings, sender),
      ...webhookRpcs(webhooks, sender),
      ...ruleRpcs(rules, shares),
    }),
  );

  const app = new Hono();

  // Errors outside the RPCs get the same JSON shape as Connect's.
  app.onError((error, c) => {
    log({ step: "http", error: String(error) });
    return c.json({ code: "internal", message: String(error) }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));
  // One line per API call, refused ones included: which RPC, its status, how long.
  app.use("/api/*", async (c, next) => {
    const started = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - started);
    log({ step: "request", path: c.req.path, status: c.res.status, durationMs });
  });
  app.use("/api/*", requireToken(apiToken));
  app.post("/api/*", (c) => rpc(c, "/api"));
  app.use("/frames/*", requireToken(apiToken));
  app.get("/frames/:shareId/:file", serveFrame(shares));

  return app;
}
