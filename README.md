# 🎬 Spotarr

Share a reel, a link, a screenshot or a text from your iPhone; Spotarr identifies the movie or TV show in the background and lets you add it to your library through Seerr. Personal project, one user, self-hosted with Docker. Also listed in [Mathieu's Umbrel community store](https://github.com/mathieuletyrant/umbrel-community-app-store).

🚧 Status: milestone 2 (web UI). Instagram reels are identified (frames and sound to the LLM, TMDB to confirm) and added through Seerr. Webhooks, then the iOS Shortcut, come next.

![The History page, in dark mode](docs/screenshots/history-dark.png)

## ✅ Run the checks

```
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` is the single gate: lint, contract lint, code generation, breaking-change detection, type check, tests. Needs [pnpm](https://pnpm.io) (the version in `package.json` is picked up automatically) and [Bun](https://bun.sh) (`.bun-version`).

## 🐳 Run it with Docker Compose

```yaml
services:
  spotarr:
    image: ghcr.io/mathieuletyrant/spotarr:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

`docker compose up -d`, then open http://localhost:3000. The API token is printed in the container logs at every start (`docker compose logs spotarr`); the UI asks for it once. Everything else (LLM, TMDB, Seerr, webhooks) is configured in Settings. Only two environment variables exist: `PORT` (default `3000`) and `DATA_DIR` (default `/data`).

⏳ The image is published from milestone 5 on. Until then, run from source: `pnpm dev`, then open http://localhost:5173.

## 🗂️ Repository

| Path | Role |
| --- | --- |
| 📜 `packages/contract` | Protobuf contract of the API, generated TypeScript |
| 🎨 `packages/design-tokens` | Design tokens, generated CSS variables |
| ⚙️ `apps/server` | The service: Hono on Bun, Connect-RPC, SQLite |
| 🖥️ `apps/web` | The web UI: React, TanStack Router and Query, Tailwind |
| 🧭 `docs/adr` | Architecture decisions |
| 📖 `GLOSSARY.md` | The project's vocabulary |
| 🤖 `AGENTS.md` | Commands, conventions, known traps |

## 🩹 Documented workarounds

- Connect-RPC is mounted inside Hono through a ~20-line adapter: [ADR 0001](docs/adr/0001-connect-rpc-mounted-in-hono.md).
- Kysely talks to `bun:sqlite` through a ~20-line in-house dialect: [ADR 0002](docs/adr/0002-kysely-over-bun-sqlite-with-custom-dialect.md).

## 🗺️ Roadmap

Milestones and issues: https://github.com/mathieuletyrant/spotarr/milestones · board: https://github.com/users/mathieuletyrant/projects/1
