# AGENTS.md

Project memory for humans and coding agents. Keep it current: a trap found while working goes here, in the PR that found it.

## What Spotarr is

Self-hosted personal service (Docker; also in Mathieu's Umbrel community store): an iOS share (any link: a video, an article, a film's page; a screenshot, a text) is identified as a movie or TV show in the background, then added to the library through Seerr once Mathieu picks a candidate in the history. One user, one server. Vocabulary: [GLOSSARY.md](./GLOSSARY.md). Decisions: [docs/adr/](./docs/adr/).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install exactly what the lockfile says |
| `pnpm check` | The whole gate: Biome → knip (unused files, exports and dependencies; `knip.json`) → `buf lint` → generate (contract, tokens) → stale-output guard → `buf breaking` → `tsc` → `bun test` |
| `pnpm format` | Rewrite files to Biome's format |
| `pnpm generate` | Regenerate `packages/contract/src/gen`, `packages/design-tokens/gen` and the database types |
| `pnpm --filter @spotarr/server clients` | Regenerate the TMDB and Seerr clients from their OpenAPI specs (network; not part of `pnpm generate`). Add a route to `TMDB_ROUTES` or `SEERR_ROUTES` in `apps/server/orval.config.ts` first |
| `brew install ffmpeg yt-dlp` | Programs the video extractor runs (tests need ffmpeg only) |
| `pnpm dev` | Run the service on :3000 (data in `./data`, API token printed at every start) and the web UI on http://localhost:5173, which forwards `/api` to the service |
| `pnpm dev:setup` | Fill the dev database: copies the `.env` keys into its settings, queues 3 sample shares, prints the API token. Run once, before `pnpm dev` |
| `pnpm build` | Build the web UI into `apps/web/dist`; the service then serves it on `/` |

## Layout

- `packages/contract`: `proto/spotarr/v1/spotarr.proto` is the single source of the API. Generated TypeScript lives in `src/gen`, committed, re-exported by `@spotarr/contract`.
- `packages/design-tokens`: `tokens.json` is the single source of style. `build.ts` emits `gen/tokens.css` (`:root` light, `.dark` dark).
- `apps/server/src`: four folders, and a rule: `api` calls `domain`, `domain` calls `integrations` and `db`, never the other way.
    - `api/`: how Spotarr talks with the outside: clients call it. `connect.ts` mounts Connect in Hono, `auth.ts` checks the token, `rpc/<domain>.ts` implements the RPCs of one domain by translating the contract into a use case and back, with no logic of its own (typed with `Rpcs<"methodName">`), `rpc/errors.ts` turns zod errors into `invalid_argument`. `messages.ts` is the only code that turns a domain Share or Candidate into a contract message. The domain never imports the contract nor `api/`. `mcp/` is the MCP server at `/mcp` (`@modelcontextprotocol/sdk` through `@hono/mcp`, stateless: one server per request), with one read-only tool per file (`list-shares.ts`, the same use case as `ListShares`, and `list-genres.ts`, the genre filter's names), answering plain JSON for an LLM rather than contract messages. `seerr-webhook.ts` is `POST /seerr/webhook`, where Seerr's Webhook agent reports a title that changed, behind the Seerr token. `app.ts` only assembles them.
    - `domain/`: what Spotarr does, one folder per domain: `settings/`, `shares/`, `identification/`, `auto-add/` (the Rules: types, repository, `preview-rules`), `collection/` (the Jellyfin Collection: `rules/collection-changes`, `use-cases/sync-collection`, run at start, every 15 minutes, after Seerr reports a title available, and by the `SyncCollection` RPC), `streaming/` (the Platforms and the Watch links, asked live from TMDB and Seerr, never stored). Each has a `use-cases/` folder, one file per action triggered by the user or the queue (`create-share`, `delete-share`, `retry-identification`, `list-history`, `add-to-library`, `identify-share`, `start-identification`, `end-identification`, `ensure-api-token`, `ensure-mcp-token`, `regenerate-mcp-token`, `ensure-seerr-token`, `regenerate-seerr-token`, `update-library-state`, `list-genres`, `list-platforms`, `list-watch-links`), next to the model it uses (types, repository, queue, extractors…). An Identification's lifecycle lives in `identification/use-cases/`: `start-identification`, `end-identification`, `retry-identification`; `shares/use-cases/` holds what is done with a Share (`create-share`, `delete-share`, `add-to-library`, `list-history`). Pure rules, with no database nor network, go in a `rules/` folder (`shares/rules/`: `summary`, `history`, `candidates-to-auto-add`), each with its test. An action that only forwards to a repository (`GetShare`, `GetSettings`) gets no use case until a rule appears. Repositories are the only code that sees Kysely; they take and return domain types.
    - `integrations/`: the services Spotarr calls: `tmdb/`, `seerr/`, `jellyfin/`, the LLM, yt-dlp, ffmpeg. `web/` reads any web page with cheerio.
    - `db/`: SQLite, dated migrations, `openDatabase()`; `db/gen/types.ts` is generated from the migrated schema.
- `apps/web`: the web UI. React, TanStack Router (one file per page in `src/routes`, route tree generated into `src/gen` by `pnpm generate`), TanStack Query through connect-query (`useQuery(SpotarrService.method.listShares, {})`, typed by the contract), Tailwind v4 themed by the design tokens (`bg-surface`, `text-text-muted`, `rounded-md`…). Sign-in: the `Login` RPC (the only one callable without the token) checks the API token and sets an HttpOnly cookie. Routes: `/login` stands alone; every other page lives under `routes/_app/`, whose layout first checks the sign-in with a `GetStatus` call and redirects to `/login` without it. Settings shows one section at a time, chosen by `?section=` (a tab per section; a dot marks unsaved changes). Query options live in `src/queries/` (`historyQuery`, `statusQuery`), built with connect-query's `createQueryOptions` / `createInfiniteQueryOptions`.
- `apps/ios`: the iOS app. `Spotarr.xcodeproj` (synchronized folders: a file added to a folder joins its target) has two targets: `Spotarr`, the app (a Liquid Glass tab bar: History, a Share's page to add a Candidate, Settings, and search), and `ShareExtension`, the share sheet's entry. Their shared code is the local Swift package `SpotarrKit`: the client generated from the contract into `Sources/SpotarrKit/gen` by `pnpm generate` (buf remote plugins, pinned to the package's swift-protobuf and connect-swift versions), the settings in a keychain shared through the `keychain-access-groups` entitlement, and its tests (`swift test --package-path apps/ios/SpotarrKit`; with `SPOTARR_TEST_URL` and `SPOTARR_TEST_TOKEN` set, one test calls a real Spotarr). Xcode may not be the selected developer directory: prefix commands with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. `.github/workflows/ios.yml` builds and tests it on macOS when `apps/ios` or the contract change.

## Code style

Mathieu learns by reading every PR. Write the most obvious code: small functions with plain names, concrete types rather than generics, a little repetition rather than an abstraction, `if` rather than nested ternaries, one-line comments that say why. If a reader needs to stop and decode a line, rewrite it.

## Web UI

Tailwind v4 syntax: the `tailwind-best-practices` skill (`.agents/skills/`, linked in `.claude/skills/`). On top of it, Spotarr's rules:

- **Colors, fonts, radii and spacing come from the design tokens only**: `bg-surface`, `text-text-muted`, `border-border`, `text-status-added`, `rounded-md`. Never Tailwind's palette (`gray-900`, `blue-500`) and never arbitrary colors (`bg-[#…]`). A missing color is added to `packages/design-tokens/tokens.json`, then `pnpm generate`.
- **No `dark:` variants**: the tokens switch every color in dark mode on their own (`.dark` block).
- **Theme**: `index.html` sets `.dark` on `<html>` before the page draws, from the header button's choice (`localStorage.theme`: system, light or dark) or the system's, and follows the system while on "system". The button (`components/theme-button.tsx`) saves a choice, then calls `window.applyTheme`.
- **Repeated class lists become a React component** (`<StatusBadge>`, `<Poster>`), not an `@apply` class. `@apply` is for `styles.css` base rules only.
- **Mobile first**: base classes for a phone, `md:` and up for wider screens. The History table becomes cards on a phone.
- **Accessible by default**: real `<button>` and `<a>`, a label on every field, visible focus (`focus-visible:`), no `autoFocus`.
- **Devtools**: under `pnpm dev`, one TanStack Devtools button (`@tanstack/react-devtools`, in `main.tsx`) opens the Query and Router panels. The `devtools()` Vite plugin, first in `vite.config.ts`, removes them from `pnpm build`.
- **Everything in English**, UI text included. The mockups are in French: translate their labels.

## How work happens

- One GitHub issue per task, one branch and one PR per issue, `Closes #N` in the PR body. `main` is protected: PR and green CI required, admins included.
- Conventional Commits, scoped: `feat(contract): …`, `fix(server): …`, `chore: …`. Everything in the repo is in English.
- The PR description says what was done, why, and explains any new notion in plain words: Mathieu learns by reading PRs.
- `pnpm check` passes locally before the PR. A PR whose CI fails is not done.
- Move the issue's card on the [project board](https://github.com/users/mathieuletyrant/projects/1): In progress → In review → Done.
- No tool swap without proposing it first. Documented integrations first; a workaround is flagged in the code and in the README.
- Nothing touches production: the Umbrel, the `mathieu-` store, Cloudflare. Tests never call the real LLM, TMDB or Seerr.
- A bug or idea found on the way becomes a new issue, not a detour in the current PR.

## Decisions that differ from the original spec

The spec document predates the grilling session of 2026-10-12. Where they disagree, the glossary, the ADRs and the issues win.

- Name is Spotarr (ex-Sharr). V1 target is Seerr only; the `Target` enum keeps `ARR` for a later milestone. Seerr decides profile and root folder.
- A TV show requests season 1 only. No manual TMDB search in V1 (no `Search` RPC).
- `Share` is the entity; RPCs are `CreateShare`, `GetShare`, `ListShares`, `RetryIdentification`, `Add`. Candidate carries a `LibraryState` enum, not `in_library`.
- Secrets are stored plain in SQLite under `/data`, visible and copyable in the UI, never logged. No encryption layer.
- No outgoing Webhooks (removed on 2026-10-18): nobody listened to them. The domain emits no Events.
- The shared video is never kept, but a 240 px thumbnail of each frame is (≈10 KB each, table `frames`), shown on the Share's page and served by `GET /frames/<share id>/<n>.jpg` behind the token. Decided 2026-10-12, against the spec's "no images kept".
- No Cloudflare Access JWT check in Spotarr for now (the spec's third layer): Access in front plus the API token are enough. Its settings (public hostname, team domain, AUD) were removed on 2026-10-12; to be decided again at the real deployment.
- An MCP server, read-only, for AI assistants like Claude (2026-10-14): its own MCP token, passed as `/mcp?token=<MCP token>` because some MCP clients only speak OAuth and send the configured URL as is. The API refuses the MCP token and `/mcp` the API token. Spotarr logs only the path, never the query.
- Seerr keeps the Library states current (2026-10-15): its Webhook agent calls `POST /seerr/webhook` with the Seerr token in `Authorization` (the token alone, Seerr's field sends it as is) and a payload naming the title only; Spotarr asks Seerr again (`libraryState()`) and writes the state on every Candidate of that title. A Candidate's status follows its Library state alone: requested then downloaded reads "Available" (`ALREADY_PRESENT`), declined reads "Can add" again. Seerr only notifies about requests: a title added straight in Radarr or deleted from Seerr changes nothing until it is requested.
- A Rule has an Action (2026-10-17, #168): `SEERR_REQUEST`, or `SEERR_WATCHLIST`, which JellyTV shows and which requests nothing. An Action names its connection: Radarr and Sonarr have no watchlist and will bring their own Actions. An Action that downloads wins over one that keeps for later, whatever the Rules' order. The watchlist is the API key's user, Seerr's owner; a title leaves it when Seerr reports it available. Spotarr keeps no trace of what it put there. Seerr hides its local watchlist from Plex accounts (they get plex.tv's), and its media server cannot be changed after setup: the owner's account must be Jellyfin or Emby.
- A Jellyfin Collection for the TV (2026-10-17, #165): Spotarr keeps one collection ("Spotted") of the titles added from a Share that Jellyfin has and the user has not watched, and owns it. Two Jellyfin plugins (Home Screen Sections, Collection Sections) show it as a Home row, which JellyTV reads. Jellyfin is optional: with no URL, nothing runs and it is not a Dependency.
- SQLite from milestone 1. No history purge, no `VACUUM INTO`. Design tokens from milestone 0; macOS CI job only with the SwiftUI app.

## Releasing

One manual step: merging the release PR. [release-please](https://github.com/googleapis/release-please-action) (`.github/workflows/release-please.yml`, `release-please-config.json`) keeps a "chore: release X.Y.Z" PR up to date from the Conventional Commits on main: `feat` bumps the minor version, `fix` the patch (a breaking change too, until 1.0).

1. The PR sets the version in `package.json`, `apps/server/package.json` (GetStatus reports it) and `apps/ios/Version.xcconfig` (the iOS app's `MARKETING_VERSION`, kept out of `project.pbxproj`, which Xcode rewrites), and adds the release's notes to `CHANGELOG.md`. `.release-please-manifest.json` holds the last version released. Never bump a version by hand.
2. Merging it tags `vX.Y.Z` and makes the GitHub Release. The tag runs `.github/workflows/release.yml`, which builds the Docker image (`Dockerfile`, Alpine + Bun + ffmpeg + yt-dlp, about 440 MB) and pushes `ghcr.io/mathieuletyrant/spotarr:X.Y.Z` and `:latest` for amd64 and arm64. It refuses a tag that differs from `apps/server/package.json`.
3. Renovate sees the new tag and opens the Umbrel store's PR for `mathieu-spotarr`, verified and merged by the store's routine.

release-please runs with `RELEASE_PLEASE_TOKEN`, a fine-grained personal access token on this repo (Contents and Pull requests: read and write). GitHub Actions' own token would open a PR that runs no CI, so `main`'s protection could never let it merge, and its tag would run no workflow. Renew the token before it expires: the Release PR workflow fails, naming it, when it is missing.

Bump `YT_DLP_VERSION` in the `Dockerfile` when Instagram, TikTok or YouTube videos stop downloading: yt-dlp follows Instagram's changes.

## Evaluation

`pnpm --filter @spotarr/server eval` runs the real Identification on the reels listed in `apps/server/scripts/eval.ts` (keys from `.env`, about $0.01 a reel, `MODEL=…` to try another model, `EFFORT=medium` or `high` another effort). A reel passes when its works are in the first 3 Candidates. Re-run it after any change to the prompt, the model, the effort or the TMDB matching, and add a case for every misidentified reel.

| Date | Model | Score | Note |
| --- | --- | --- | --- |
| 2026-10-12 | google/gemini-3.8-flash | 6/6 | twice in a row; L'Invitation failed once in 4 earlier runs (a 2022 namesake) |

## Known traps

- **pnpm 12 build scripts**: `onlyBuiltDependencies` is ignored; approve scripts with `allowBuilds` in `pnpm-workspace.yaml`, else `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`.
- **`pnpm -r <name>` with no such script**: pnpm falls back to `exec <name>` and fails. Only add a root script once a package implements it.
- **Biome 2.5 config keys**: `linter.rules.preset` (not `recommended`), `vcs.useIgnoreFile` (singular).
- **Stale generated output**: `pnpm check` regenerates and fails if `**/gen/**` differs from what is committed. Run `pnpm generate` and commit. On a brand-new generated file the guard also fails until the file is committed once. The guard is `scripts/check-generated.ts`.
- **`buf breaking`** compares against `main` on GitHub over the network; it needs the repo to stay public (or a token later). It checks the `WIRE_JSON` rules (2026-10-18): what a client sees on the wire. Deleting an RPC or a message passes; a removed field's number and name go in `reserved`.
- **Style Dictionary collision warning**: light and dark tokens share one CSS name on purpose; `log.warnings` is disabled in `build.ts` for that reason.
- **Migrations run in the alphabetical order of their names**: name a new one `YYYY-MM-DDTHHMM-what.ts` (e.g. `2026-10-12T1400-frames`). A name that sorts before an applied migration makes Kysely refuse to start on an existing database.
- **Kysely 0.29 moved migrations**: `Migrator` and `Migration` come from `kysely/migration`, not `kysely`. The root import fails at runtime with "Export named 'Migrator' not found".
- **kysely-codegen CLI**: its bun:sqlite path needs `kysely-bun-sqlite`, the broken dialect. `apps/server/scripts/codegen.ts` calls `generate()` with our own Kysely instance instead.
- **SQLite TEXT primary keys accept NULL** unless declared `notNull()`; the generated type then reads `string | null`.
- **zod 4 object defaults**: `.default({})` on an object returns `{}` as is, without the inner defaults. Use `.prefault({})`, which parses `{}` and so fills them.
- **Connect messages carry `$typeName`**: a request object has an extra `$typeName` key on every message. Code iterating over its keys must skip it; zod strips it when parsing.
- **Summary and history are TypeScript**: `domain/shares/rules/summary.ts` (the glossary's rules, in order) and `domain/shares/rules/history.ts` (filters and pagination over the whole history). Fine for one person's history; move them to SQL if it grows past a few thousand Shares.
- **Testing background work**: `apps/server/src/domain/shares/test-helpers.ts` has `until()` (poll a condition) and `deferred()` (end an Identification when the test decides). Never `sleep` a fixed time. `ShareQueue` runs a Share's whole lifecycle (claim, identify, finish, then auto add): `concurrency` workers loop over the `QUEUED` rows, checking again every second when there are none (`idleMs: 5` in tests). A test passes `identify`, never the end step; a harness that creates Shares by hand and finishes them itself starts no queue.
- **TMDB client is generated by Orval** from TMDB's OpenAPI spec: typed functions in `src/integrations/tmdb/gen/tmdb.ts`, typed fake answers in `src/integrations/tmdb/gen/tmdb.faker.ts`. TMDB's spec marks no field required, leaves `tv_results` untyped and describes only the 200 answer: `src/integrations/tmdb/client.ts` handles those gaps in one place.
- **TMDB's watch providers**: its spec types every country of a title's providers as its own type and lists only `rent`, `buy` and `flatrate`, while answers also carry `free` and `ads`. `Tmdb.watchOffers` reads the country by its code through one cast. The country is the one chosen in Settings → Streaming, else the TMDB language's (`fr-FR` → `FR`): `countryFrom()` in `settings/adapters.ts`. TMDB gives no link to the Platform itself, only its page of where to watch the title.
- **Seerr's library links**: `mediaInfo.mediaUrl` (the title's page on Jellyfin, Plex or Emby) and `ratingKey` are in Seerr's answers, not its spec; `Seerr.libraryLink` reads them untyped.
- **Seerr's spec does not match its answers** (same on v3.5.0, main, develop: `watchProviders` nesting, nullable `modifiedBy`…). Orval generates its client and fakes from the spec pinned to v3.5.0, without zod validation of answers. Its address being a setting, every generated call goes through `integrations/seerr/seerr-fetch.ts` (an Orval "mutator") with `{ seerr: { url, apiKey } }` in its options.
- **Seerr's spec names a watchlist entry's media type `type`**, its server reads `mediaType`: `seerrSpec()` in `orval.config.ts` corrects the `Watchlist` schema before generating. Adding one already there answers 409, removing one not there 404: `seerrFetch`'s `alsoFine` lets those calls take them as answers.
- **Jellyfin's client is generated by Orval** from its spec pinned to the Umbrel's version (12.2), keeping only the operations Spotarr calls (`JELLYFIN_OPERATIONS`: `DELETE /Items` deletes media) and the types they reach, else 12 000 lines. Its address being a setting, calls go through `integrations/jellyfin/jellyfin-fetch.ts`. The generated answers list every status of the spec; the fetch throws on all but 2xx, so `client.ts` keeps the 200 one (`ok()`). The API key goes in `Authorization: MediaBrowser Token="…"`: Jellyfin can turn `X-Emby-Token` off.
- **Jellyfin cannot filter `/Items` on a TMDB id**: the sync lists every movie and series with `hasTmdbId` and `fields=ProviderIds` once, and matches them by `ProviderIds.Tmdb`. A series is "watched" (`UserData.Played`) once every episode it has is.
- **openapi-typescript does not run with TypeScript 7** (it drives the compiler API, gone in 7). Orval does not need it.
- **MSW 3 does not intercept fetch under Bun 1.4** ("Failed to replace a global value"). Tests fake `fetch` with `spyOn` instead: `fakeFetch` in `src/testing/fake-fetch.ts` answers by URL path, undone by `mock.restore()`.
- **yt-dlp on Instagram**: format selectors with conditions (`worst[ext=mp4]`) fail, because Instagram announces neither size nor resolution. Plain `--format worst` works. YouTube offers no file with both sound and picture: the selector falls back to `wv[height>=360][width>=360]+wa` (width too, a Short being vertical), merged by ffmpeg. YouTube also needs a JavaScript runtime: `--js-runtimes bun`, yt-dlp only looks for Deno by default. Public reels need no cookies: the cookies.txt setting was removed on 2026-10-12, to come back only if private reels or a login wall show up.
- **Shared links are read as a web page first** (`extractors/link.ts`): a page with IMDb or TMDB links (Letterboxd writes its TMDB id on `<body data-tmdb-id>`, Wikipedia links both) is identified from them, with no video download and no LLM. Otherwise yt-dlp reads the link; when it fails (an article: "Unsupported URL", or a reel Instagram refuses), the page's title, description, paragraphs, JSON-LD `Movie`/`TVSeries` and `og:image` go to the LLM instead. A page with no description and almost no text (a login wall) counts as unread. `integrations/web/page.ts` sends a Safari User-Agent: Wikipedia answers 403 to bots. Fixture pages are recorded third-party HTML, so Biome skips `**/fixtures/*.html`.
- **Instagram photo posts**: yt-dlp only reads videos and answers "There is no video in this post"; on that exact message (`isNoVideoError`, kept inside `integrations/ytdlp`) `readVideo` returns `undefined`, and `readLink` (`extractors/link.ts`) calls `readPhoto` (`extractors/photo.ts`) instead. A `Photo` is not a `Video`: one picture for the LLM, no sound, no frames kept. `integrations/instagram/post.ts` reads the public page's Open Graph tags (caption and author from `og:title`, first picture from `og:image`, 640 px square crop). From some addresses (cloud machines) yt-dlp answers "Instagram sent an empty media response" instead, for photos and reels alike: no fallback then. Attribute values come HTML-escaped (`&quot;`, `&#064;`) and Bun's `HTMLRewriter` does not decode them: `post.ts` does.
- **Programs are run through `integrations/process.ts`**: one place for timeouts and error messages. Tests use the real ffmpeg on `integrations/ffmpeg/fixtures/test-pattern.mp4`; yt-dlp is never run in tests (no network), only its recorded JSON is parsed.
- **Integrations take plain config, never a repository**: `new Tmdb({ token, language })`, `chat(config, messages)`. `domain/settings/adapters.ts` (`tmdbFrom`, `seerrFrom`, `llmConfigFrom`) is the one place that turns the Settings into each integration's config; `start-identification` reads the Settings once per Identification.
- **Errors are `SpotarrError`s** (`src/errors.ts`): one class, seven codes (`unauthenticated`, `invalid_input`, `not_found`, `busy`, `not_configured`, `unavailable`, `timeout`). Never `throw new Error(...)` in production code; integrations turn their failures (status, network, timeout) into a code and a message naming the service. `api/rpc/errors.ts` maps codes to Connect codes for the UI; zod errors become `invalid_argument`; anything else is `internal` and logged.
- **LLM answers are typed by structured outputs**: `chat(config, messages, schema)` sends the zod schema as a strict JSON schema (`zodResponseFormat`) and returns the parsed object. Never describe the JSON format in a prompt. In a strict schema every field is required: use `.nullable()`, not `.optional()`, and `.describe()` to explain a field to the model.
- **Live checks use the gitignored `.env`** at the repo root (OpenRouter key, TMDB token, Seerr). Spotarr itself never reads it; push the values into a dev server with `UpdateSettings`. Never print them.
- **knip** reports code nobody uses. Its `knip.json` declares what it cannot see: the entry points (scripts, migrations, the Shortcut's build), `protoc-gen-es` (run by buf), and macOS's `plutil` and `shortcuts`. Generated code and `apps/ios` are ignored. An export used only in its own file is reported: drop the `export`.
- **`pnpm exec biome`** may print an odd "ESLint output" line from a shell hook; use `pnpm lint` / `pnpm format`.
- **Agent skills** come from skills.sh: `npx skills add <owner/repo> -s <skill> -a claude-code -y` copies one into `.claude/skills/` and records it in `skills-lock.json`; `npx skills update` refreshes them. Biome skips `.claude/skills` (third-party files, e.g. an SVG failing `noSvgWithoutTitle`).

## Versions

Pinned at the latest stable on 2026-10-12 and bumped weekly by Renovate: pnpm 12.11.2, Bun 1.4.3, TypeScript 7.0.2, Biome 2.5.15, buf 1.73.0, protobuf-es 2.16.0, style-dictionary 5.6.1, kysely 0.29.6, kysely-codegen 0.20.0, hono 4.13.13, @connectrpc/connect 2.2.0, zod 4.6.6. If a newer version breaks another tool, keep the newest that works and note it here.
