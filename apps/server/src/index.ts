import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { createIdentify } from "./identification/identify";
import { ensureApiToken } from "./settings/api-token";
import { SettingsRepository } from "./settings/repository";
import { ShareQueue } from "./shares/queue";
import { ShareRepository } from "./shares/repository";
import { tmdbFromSettings } from "./tmdb/from-settings";

// The only two environment variables; everything else is set in the UI.
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? "/data";

mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));

const settings = new SettingsRepository(db);
const { token, created } = await ensureApiToken(settings);
if (created) console.log(`API token (also in Settings → Access): ${token}`);

const shares = new ShareRepository(db);
const queue = new ShareQueue(
  shares,
  createIdentify(tmdbFromSettings(settings)),
  async () => (await settings.get()).extraction.concurrency,
);
await queue.start();

const app = createApp({ apiToken: () => token, settings, shares, queue });
Bun.serve({ port, fetch: app.fetch });
console.log(`spotarr listening on :${port}`);
