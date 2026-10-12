import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { readVideo } from "./domain/identification/extractors/video";
import { AnswerSchema } from "./domain/identification/guess-titles";
import { identifyShare } from "./domain/identification/use-cases/identify-share";
import { SettingsRepository } from "./domain/settings/repository";
import type { Settings } from "./domain/settings/schema";
import { ensureApiToken } from "./domain/settings/use-cases/ensure-api-token";
import { ShareQueue } from "./domain/shares/queue";
import { ShareRepository } from "./domain/shares/repository";
import type { ShareInput } from "./domain/shares/types";
import { WebhookRepository } from "./domain/webhooks/repository";
import { WebhookSender } from "./domain/webhooks/sender";
import { chat, type LlmConfig } from "./integrations/llm/client";
import { Seerr } from "./integrations/seerr/client";
import { Tmdb } from "./integrations/tmdb/client";
import { log } from "./log";

// The only two environment variables; everything else is set in the UI.
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? "/data";

mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));

const settings = new SettingsRepository(db);
const { token, created } = await ensureApiToken(settings);
// Printed at every start: the logs are where the token is found again if
// lost, since the Settings page that shows it needs it to sign in.
console.log(`API token${created ? " (new)" : ""}: ${token}`);

const shares = new ShareRepository(db);

// Settings are read once per Identification, so a change applies to the next share.
async function runIdentification(shareId: string, input: ShareInput) {
  const { identification, extraction } = await settings.get();
  return identifyShare(shareId, input, {
    tmdb: new Tmdb({ token: identification.tmdbToken, language: identification.language }),
    seerr: await seerrFromSettings(),
    readVideo: (url) => readVideo(url, extraction),
    llm: (messages) => chat(llmConfig(identification), messages, AnswerSchema),
  });
}

async function seerrFromSettings() {
  const { seerr } = await settings.get();
  return new Seerr({ url: seerr.url, apiKey: seerr.apiKey });
}

function llmConfig(identification: Settings["identification"]): LlmConfig {
  return {
    apiUrl: identification.llmApiUrl,
    apiKey: identification.llmApiKey,
    model: identification.model,
  };
}

const webhooks = new WebhookRepository(db);
const sender = new WebhookSender(webhooks, async () => (await settings.get()).webhooks.webUiUrl);

// When an Identification ends, the Webhooks hear about it.
async function identificationEnded(shareId: string) {
  const share = await shares.get(shareId);
  if (share) await sender.identificationEnded(share);
}

const queue = new ShareQueue(
  shares,
  runIdentification,
  async () => (await settings.get()).extraction.concurrency,
  identificationEnded,
);
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
  seerr: seerrFromSettings,
  webDir: existsSync(webDir) ? webDir : undefined,
});
Bun.serve({ port, fetch: app.fetch });
log({ step: "start", port });
