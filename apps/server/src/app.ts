import { SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import { requireToken } from "./http/auth";
import { connectHandler } from "./http/connect";
import { validationErrors } from "./rpc/errors";
import { settingsRpcs } from "./rpc/settings";
import { shareRpcs } from "./rpc/shares";
import { statusRpcs } from "./rpc/status";
import type { SettingsRepository } from "./settings/repository";
import type { ShareQueue } from "./shares/queue";
import type { ShareRepository } from "./shares/repository";

export type AppDeps = {
  apiToken: () => string;
  settings: SettingsRepository;
  shares: ShareRepository;
  queue: ShareQueue;
};

// Routes: GET /health (open), POST /api/* (Connect RPCs, token required).
// Each file in rpc/ implements the RPCs of one domain.
export function createApp({ apiToken, settings, shares, queue }: AppDeps): Hono {
  const rpc = connectHandler({ interceptors: [validationErrors] }, (router) =>
    router.service(SpotarrService, {
      ...statusRpcs(),
      ...settingsRpcs(settings),
      ...shareRpcs(shares, queue),
    }),
  );

  return new Hono()
    .get("/health", (c) => c.json({ ok: true }))
    .use("/api/*", requireToken(apiToken))
    .post("/api/*", (c) => rpc(c, "/api"));
}
