import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { seerrFrom } from "./domain/settings/adapters";
import { SettingsRepository } from "./domain/settings/repository";
import { ensureApiToken } from "./domain/settings/use-cases/ensure-api-token";
import { ShareQueue } from "./domain/shares/queue";
import { ShareRepository } from "./domain/shares/repository";
import { WebhookRepository } from "./domain/webhooks/repository";
import { WebhookSender } from "./domain/webhooks/sender";
import { log } from "./log";

// The only environment variables; everything else is set in the UI.
// API_TOKEN (optional) fixes the API token, e.g. to the Umbrel app password.
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? "/data";

mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));

const settings = new SettingsRepository(db);
const { token, created } = await ensureApiToken(settings, process.env.API_TOKEN);
// Printed at every start: the logs are where the token is found again if
// lost, since the Settings page that shows it needs it to sign in.
console.log(`API token${created ? " (new)" : ""}: ${token}`);

const shares = new ShareRepository(db);

const webhooks = new WebhookRepository(db);
const sender = new WebhookSender(webhooks, async () => (await settings.get()).webhooks.webUiUrl);

const queue = new ShareQueue({ shares, settings, sender });
await queue.start();

// The web UI, once built (pnpm build). In dev, Vite serves it instead.
const webDir = new URL("../../web/dist", import.meta.url).pathname;

const app = createApp({
  apiToken: () => token,
  settings,
  shares,
  queue,
  webhooks,
  sender,
  seerr: async () => seerrFrom(await settings.get()),
  webDir: existsSync(webDir) ? webDir : undefined,
});
Bun.serve({ port, fetch: app.fetch });
log({ step: "start", port });
