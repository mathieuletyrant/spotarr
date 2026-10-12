import { SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import { requireToken } from "./api/auth";
import { connectHandler } from "./api/connect";
import { validationErrors } from "./api/rpc/errors";
import { settingsRpcs } from "./api/rpc/settings";
import { shareRpcs } from "./api/rpc/shares";
import { statusRpcs } from "./api/rpc/status";
import type { SettingsRepository } from "./domain/settings/repository";
import type { ShareQueue } from "./domain/shares/queue";
import type { ShareRepository } from "./domain/shares/repository";

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
