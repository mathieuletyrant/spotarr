import type { MessageInitShape } from "@bufbuild/protobuf";
import { type GetStatusResponseSchema, SpotarrService } from "@spotarr/contract";
import { Hono } from "hono";
import pkg from "../package.json";
import { requireToken } from "./http/auth";
import { connectHandler } from "./http/connect";

export type AppDeps = { apiToken: () => string };

export function createApp({ apiToken }: AppDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  const rpc = connectHandler((router) =>
    router.service(SpotarrService, {
      // `satisfies` makes a renamed contract field a type error here.
      getStatus: () =>
        ({ version: pkg.version }) satisfies MessageInitShape<typeof GetStatusResponseSchema>,
    }),
  );
  app.use("/api/*", requireToken(apiToken));
  app.post("/api/*", (c) => rpc(c, "/api"));

  return app;
}
