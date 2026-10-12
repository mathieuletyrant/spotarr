import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { readVideo } from "./domain/identification/extractors/video";
import { identify } from "./domain/identification/identify";
import { ensureApiToken } from "./domain/settings/api-token";
import { SettingsRepository } from "./domain/settings/repository";
import { ShareQueue } from "./domain/shares/queue";
import { ShareRepository } from "./domain/shares/repository";
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
const tmdb = new Tmdb(settings);
const queue = new ShareQueue(
  shares,
  async (input) => {
    const { extraction } = await settings.get();
    return identify(input, { tmdb, readVideo: (url) => readVideo(url, extraction) });
  },
  async () => (await settings.get()).extraction.concurrency,
);
await queue.start();

const app = createApp({ apiToken: () => token, settings, shares, queue });
Bun.serve({ port, fetch: app.fetch });
console.log(`spotarr listening on :${port}`);
