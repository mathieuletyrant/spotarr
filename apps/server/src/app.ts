import { SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import { requireToken } from "./api/auth";
import { connectHandler } from "./api/connect";
import { errorsToConnect } from "./api/rpc/errors";
import { settingsRpcs } from "./api/rpc/settings";
import { shareRpcs } from "./api/rpc/shares";
import { statusRpcs } from "./api/rpc/status";
import type { SettingsRepository } from "./domain/settings/repository";
import type { ShareQueue } from "./domain/shares/queue";
import type { ShareRepository } from "./domain/shares/repository";
import type { Seerr } from "./integrations/seerr/client";

export type AppDeps = {
  apiToken: () => string;
  settings: SettingsRepository;
  shares: ShareRepository;
  queue: ShareQueue;
  // Built from the settings at each call, so a change applies at once.
  seerr: () => Promise<Seerr>;
};

// Routes: GET /health (open), POST /api/* (Connect RPCs, token required).
// Each file in rpc/ implements the RPCs of one domain.
export function createApp({ apiToken, settings, shares, queue, seerr }: AppDeps): Hono {
  const rpc = connectHandler({ interceptors: [errorsToConnect] }, (router) =>
    router.service(SpotarrService, {
      ...statusRpcs(),
      ...settingsRpcs(settings),
      ...shareRpcs(shares, queue, seerr),
    }),
  );

  return (
    new Hono()
      // Errors outside the RPCs get the same JSON shape as Connect's.
      .onError((error, c) => {
        console.error(JSON.stringify({ step: "http", error: String(error) }));
        return c.json({ code: "internal", message: String(error) }, 500);
      })
      .get("/health", (c) => c.json({ ok: true }))
      .use("/api/*", requireToken(apiToken))
      .post("/api/*", (c) => rpc(c, "/api"))
  );
}
