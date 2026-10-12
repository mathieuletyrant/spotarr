import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { readVideo } from "./domain/identification/extractors/video";
import { GuessesSchema } from "./domain/identification/guess-titles";
import { identify } from "./domain/identification/identify";
import { ensureApiToken } from "./domain/settings/api-token";
import { SettingsRepository } from "./domain/settings/repository";
import type { Settings } from "./domain/settings/schema";
import { ShareQueue } from "./domain/shares/queue";
import { ShareRepository } from "./domain/shares/repository";
import type { ShareInput } from "./domain/shares/types";
import { chat, type LlmConfig } from "./integrations/llm/client";
import { Seerr } from "./integrations/seerr/client";
import { Tmdb } from "./integrations/tmdb/client";

// The only two environment variables; everything else is set in the UI.
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? "/data";

mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));

const settings = new SettingsRepository(db);
const { token, created } = await ensureApiToken(settings);
if (created) console.log(`API token (also in Settings → Access): ${token}`);

const shares = new ShareRepository(db);

// Settings are read once per Identification, so a change applies to the next share.
async function identifyShare(input: ShareInput) {
  const { identification, extraction } = await settings.get();
  return identify(input, {
    tmdb: new Tmdb({ token: identification.tmdbToken, language: identification.language }),
    seerr: await seerrFromSettings(),
    readVideo: (url) => readVideo(url, extraction),
    llm: (messages) => chat(llmConfig(identification), messages, GuessesSchema),
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

const queue = new ShareQueue(
  shares,
  identifyShare,
  async () => (await settings.get()).extraction.concurrency,
);
await queue.start();

const app = createApp({ apiToken: () => token, settings, shares, queue, seerr: seerrFromSettings });
Bun.serve({ port, fetch: app.fetch });
console.log(`spotarr listening on :${port}`);
