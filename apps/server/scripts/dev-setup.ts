// Local dev only: fills the dev database (./data at the repo root) so `pnpm dev`
// has something to show. Copies the keys of the gitignored .env into the
// settings, and queues a few sample shares, identified when `pnpm dev` starts.
// Spotarr itself never reads .env.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../src/db";
import { SettingsRepository } from "../src/domain/settings/repository";
import { ensureApiToken } from "../src/domain/settings/use-cases/ensure-api-token";
import { ShareRepository } from "../src/domain/shares/repository";

const SAMPLE_SHARES = [
  { url: "https://www.instagram.com/reel/DeHYOAbo14f/", source: "instagram.com" }, // 3 films, LLM
  { url: "https://www.themoviedb.org/movie/424", source: "themoviedb.org" }, // in the library
  { url: "https://www.themoviedb.org/tv/18165", source: "themoviedb.org" }, // partly in the library
];

const dataDir = new URL("../../../data", import.meta.url).pathname;
mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));

// Bun loads the .env of the current folder: the script runs from the repo root.
const env = process.env;
const settings = new SettingsRepository(db);
await settings.update({
  identification: { llmApiKey: env.OPENROUTER_API_KEY ?? "", tmdbToken: env.TMDB_TOKEN ?? "" },
  seerr: { url: env.SEERR_URL ?? "", apiKey: env.SEERR_API_KEY ?? "" },
});

const shares = new ShareRepository(db);
if ((await shares.all()).length === 0) {
  for (const { url, source } of SAMPLE_SHARES) await shares.create({ url }, source);
}

const { token } = await ensureApiToken(settings);
const missing = ["OPENROUTER_API_KEY", "TMDB_TOKEN", "SEERR_URL", "SEERR_API_KEY"].filter(
  (k) => !env[k],
);
console.log(`Dev database ready: ${dataDir}`);
if (missing.length > 0) console.log(`Missing in .env: ${missing.join(", ")}`);
console.log(`API token to sign in: ${token}`);
console.log("Now: pnpm dev, then open http://localhost:5173");
await db.destroy();
