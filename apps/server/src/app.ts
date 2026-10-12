import type { MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  type GetSettingsResponseSchema,
  type GetStatusResponseSchema,
  SpotarrService,
  type UpdateSettingsResponseSchema,
} from "@spotarr/contract";
import { Hono } from "hono";
import { z } from "zod";
import pkg from "../package.json";
import { requireToken } from "./http/auth";
import { connectHandler } from "./http/connect";
import type { Settings } from "./settings/schema";
import type { SettingsService } from "./settings/service";

export type AppDeps = { apiToken: () => string; settings: SettingsService };

export function createApp({ apiToken, settings }: AppDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  // The API token lives apart from the editable settings but is shown with them.
  const withToken = (s: Settings) => ({ ...s, access: { ...s.access, apiToken: apiToken() } });

  // `satisfies` on each response makes a renamed contract field a type error here.
  const rpc = connectHandler((router) =>
    router.service(SpotarrService, {
      getStatus: () =>
        ({ version: pkg.version }) satisfies MessageInitShape<typeof GetStatusResponseSchema>,

      getSettings: async () =>
        ({ settings: withToken(await settings.get()) }) satisfies MessageInitShape<
          typeof GetSettingsResponseSchema
        >,

      updateSettings: async (req) => {
        try {
          const saved = await settings.update(req.settings ?? {});
          return { settings: withToken(saved) } satisfies MessageInitShape<
            typeof UpdateSettingsResponseSchema
          >;
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ConnectError(z.prettifyError(error), Code.InvalidArgument);
          }
          throw error;
        }
      },
    }),
  );
  app.use("/api/*", requireToken(apiToken));
  app.post("/api/*", (c) => rpc(c, "/api"));

  return app;
}
