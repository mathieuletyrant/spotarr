import { SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import { requireToken } from "./api/auth";
import { connectHandler } from "./api/connect";
import { serveFrame } from "./api/frames";
import { authRpcs } from "./api/rpc/auth";
import { errorsToConnect } from "./api/rpc/errors";
import { settingsRpcs } from "./api/rpc/settings";
import { shareRpcs } from "./api/rpc/shares";
import { statusRpcs } from "./api/rpc/status";
import { webhookRpcs } from "./api/rpc/webhooks";
import { serveWebApp } from "./api/web";
import type { SettingsRepository } from "./domain/settings/repository";
import type { ShareRepository } from "./domain/shares/repository";
import type { WebhookRepository } from "./domain/webhooks/repository";
import type { WebhookSender } from "./domain/webhooks/sender";
import type { Seerr } from "./integrations/seerr/client";
import { log } from "./log";

export type AppDeps = {
  apiToken: () => string;
  settings: SettingsRepository;
  shares: ShareRepository;
  webhooks: WebhookRepository;
  sender: WebhookSender;
  // Built from the settings at each call, so a change applies at once.
  seerr: () => Promise<Seerr>;
  // The built web UI; absent in tests and when running the API alone.
  webDir?: string;
};

// Routes: GET /health (open), POST /api/* (Connect RPCs, token required but
// for Login), GET /frames/* (video thumbnails, token required), and the web UI
// on every other GET.
// Each file in api/rpc/ implements the RPCs of one domain.
export function createApp({
  apiToken,
  settings,
  shares,
  webhooks,
  sender,
  seerr,
  webDir,
}: AppDeps): Hono {
  const rpc = connectHandler({ interceptors: [errorsToConnect] }, (router) =>
    router.service(SpotarrService, {
      ...authRpcs(apiToken),
      ...statusRpcs(settings, shares),
      ...settingsRpcs(settings),
      ...shareRpcs(shares, seerr, sender),
      ...webhookRpcs(webhooks, sender),
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
  if (webDir) app.get("*", serveWebApp(webDir));

  return app;
}
