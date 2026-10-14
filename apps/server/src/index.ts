import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { serveWebApp } from "./api/web";
import { WebhookSender } from "./api/webhooks/sender";
import { createApp } from "./app";
import { openDatabase } from "./db";
import { RuleRepository } from "./domain/auto-add/repository";
import { tmdbFrom } from "./domain/settings/adapters";
import { SettingsRepository } from "./domain/settings/repository";
import { ensureApiToken } from "./domain/settings/use-cases/ensure-api-token";
import { ensureMcpToken } from "./domain/settings/use-cases/ensure-mcp-token";
import type { Event } from "./domain/shares/events";
import { ShareQueue } from "./domain/shares/queue";
import { ShareRepository } from "./domain/shares/repository";
import { fillMissingDetails } from "./domain/shares/use-cases/fill-missing-details";
import { WebhookRepository } from "./domain/webhooks/repository";
import { log } from "./log";

// ── 1. Config ────────────────────────────────────────────────────────
// The only environment variables; everything else is set in the UI.
// API_TOKEN (optional) fixes the API token, e.g. to the Umbrel app password.
const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? "/data";

// ── 2. Storage: the database and its repositories ───────────────────
mkdirSync(dataDir, { recursive: true });
const db = await openDatabase(join(dataDir, "spotarr.db"));
const settings = new SettingsRepository(db);
const shares = new ShareRepository(db);
const webhooks = new WebhookRepository(db);
const rules = new RuleRepository(db);

// Printed at every start: the logs are where the token is found again if
// lost, since the Settings page that shows it needs it to sign in.
const { token, created } = await ensureApiToken(settings, process.env.API_TOKEN);
console.log(`API token${created ? " (new)" : ""}: ${token}`);
// Shown in the Settings page only, never printed.
await ensureMcpToken(settings);

// ── 3. Background: the Webhooks listen to Events, workers identify ──
const sender = new WebhookSender(webhooks, async () => (await settings.get()).webhooks.webUiUrl);
const emit = (event: Event) => sender.emit(event);
await new ShareQueue({ shares, settings, rules, emit }).start();
// Not awaited: Spotarr answers while older Shares get their TMDB details.
const today = new Date().toISOString().slice(0, 10);
fillMissingDetails(shares, tmdbFrom(await settings.get()), today)
  .then((filled) => log({ step: "tmdb details", filled }))
  .catch((error) => log({ step: "tmdb details", error: String(error) }));

// ── 4. API: /health, the RPCs under /api, the frames, /mcp ──────────
const app = createApp({ apiToken: () => token, settings, shares, webhooks, rules, sender });

// ── 5. Web UI: the built front (pnpm build), on every other GET ─────
// Added last, so it never catches an API route. In dev, Vite serves the
// front itself and forwards /api here.
const webDir = new URL("../../web/dist", import.meta.url).pathname;
if (existsSync(webDir)) app.get("*", serveWebApp(webDir));

Bun.serve({ port, fetch: app.fetch });
log({ step: "start", port });
