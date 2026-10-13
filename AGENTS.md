# AGENTS.md

Project memory for humans and coding agents. Keep it current: a trap found while working goes here, in the PR that found it.

## What Spotarr is

Self-hosted personal service (Docker; also in Mathieu's Umbrel community store): an iOS share (reel, link, screenshot, text) is identified as a movie or TV show in the background, then added to the library through Seerr once Mathieu picks a candidate in the history. One user, one server. Vocabulary: [GLOSSARY.md](./GLOSSARY.md). Decisions: [docs/adr/](./docs/adr/).

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
    - `api/`: how clients talk to Spotarr. `connect.ts` mounts Connect in Hono, `auth.ts` checks the token, `rpc/<domain>.ts` implements the RPCs of one domain by translating the contract into a use case and back, with no logic of its own (typed with `Rpcs<"methodName">`), `rpc/errors.ts` turns zod errors into `invalid_argument`. `app.ts` only assembles them.
    - `domain/`: what Spotarr does, one folder per domain: `settings/`, `shares/`, `identification/`. Each has a `use-cases/` folder, one file per action triggered by the user or the queue (`create-share`, `retry-identification`, `list-history`, `add-candidate`, `identify-share`, `ensure-api-token`), next to the model it uses (types, repository, summary, history, queue, extractors…). An action that only forwards to a repository (`GetShare`, `GetSettings`) gets no use case until a rule appears. Repositories are the only code that sees Kysely; they take and return domain types.
    - `integrations/`: the services Spotarr calls. `tmdb/` today; Seerr, the LLM and yt-dlp come next to it.
    - `db/`: SQLite, dated migrations, `openDatabase()`; `db/gen/types.ts` is generated from the migrated schema.
- `apps/web`: the web UI. React, TanStack Router (one file per page in `src/routes`, route tree generated into `src/gen` by `pnpm generate`), TanStack Query through connect-query (`useQuery(SpotarrService.method.listShares, {})`, typed by the contract), Tailwind v4 themed by the design tokens (`bg-surface`, `text-text-muted`, `rounded-md`…). Sign-in: the `Login` RPC (the only one callable without the token) checks the API token and sets an HttpOnly cookie. Routes: `/login` stands alone; every other page lives under `routes/_app/`, whose layout first checks the sign-in with a `GetStatus` call and redirects to `/login` without it. Query options live in `src/queries/` (`historyQuery`, `statusQuery`), built with connect-query's `createQueryOptions` / `createInfiniteQueryOptions`.
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
- Webhooks carry the full payload (poster, confidence, library state); Spotarr has no Home Assistant code.
- The shared video is never kept, but a 240 px thumbnail of each frame is (≈10 KB each, table `frames`), shown on the Share's page and served by `GET /frames/<share id>/<n>.jpg` behind the token. Decided 2026-10-12, against the spec's "no images kept".
- No Cloudflare Access JWT check in Spotarr for now (the spec's third layer): Access in front plus the API token are enough. Its settings (public hostname, team domain, AUD) were removed on 2026-10-12; to be decided again at the real deployment.
- SQLite from milestone 1. No history purge, no `VACUUM INTO`. Design tokens from milestone 0; macOS CI job only with the SwiftUI app.

## Releasing

The Docker image (`Dockerfile`, Alpine + Bun + ffmpeg + yt-dlp, about 440 MB) is published by `.github/workflows/release.yml` when a tag is pushed:

1. Bump `version` in `apps/server/package.json` in a PR (GetStatus reports it), and merge it.
2. On main: `git tag vX.Y.Z && git push origin vX.Y.Z`. The workflow refuses a tag that differs from that version.
3. It pushes `ghcr.io/mathieuletyrant/spotarr:X.Y.Z` and `:latest` for amd64 and arm64. The Umbrel store app (`mathieu-spotarr`) pins the new digest.

Bump `YT_DLP_VERSION` in the `Dockerfile` when Instagram, TikTok or YouTube videos stop downloading: yt-dlp follows Instagram's changes.

## Evaluation

`pnpm --filter @spotarr/server eval` runs the real Identification on the reels listed in `apps/server/scripts/eval.ts` (keys from `.env`, about $0.01 a reel, `MODEL=… ` to try another model). A reel passes when its works are in the first 3 Candidates. Re-run it after any change to the prompt, the model or the TMDB matching, and add a case for every misidentified reel.

| Date | Model | Score | Note |
| --- | --- | --- | --- |
| 2026-10-12 | google/gemini-3.8-flash | 6/6 | twice in a row; L'Invitation failed once in 4 earlier runs (a 2022 namesake) |

## Known traps

- **pnpm 12 build scripts**: `onlyBuiltDependencies` is ignored; approve scripts with `allowBuilds` in `pnpm-workspace.yaml`, else `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`.
- **`pnpm -r <name>` with no such script**: pnpm falls back to `exec <name>` and fails. Only add a root script once a package implements it.
- **Biome 2.5 config keys**: `linter.rules.preset` (not `recommended`), `vcs.useIgnoreFile` (singular).
- **Stale generated output**: `pnpm check` regenerates and fails if `**/gen/**` differs from what is committed. Run `pnpm generate` and commit. On a brand-new generated file the guard also fails until the file is committed once. The guard is `scripts/check-generated.ts`.
- **`buf breaking`** compares against `main` on GitHub over the network; it needs the repo to stay public (or a token later).
- **Style Dictionary collision warning**: light and dark tokens share one CSS name on purpose; `log.warnings` is disabled in `build.ts` for that reason.
- **Migrations run in the alphabetical order of their names**: name a new one `YYYY-MM-DDTHHMM-what.ts` (e.g. `2026-10-12T1400-frames`). A name that sorts before an applied migration makes Kysely refuse to start on an existing database.
- **Kysely 0.29 moved migrations**: `Migrator` and `Migration` come from `kysely/migration`, not `kysely`. The root import fails at runtime with "Export named 'Migrator' not found".
- **kysely-codegen CLI**: its bun:sqlite path needs `kysely-bun-sqlite`, the broken dialect. `apps/server/scripts/codegen.ts` calls `generate()` with our own Kysely instance instead.
- **SQLite TEXT primary keys accept NULL** unless declared `notNull()`; the generated type then reads `string | null`.
- **zod 4 object defaults**: `.default({})` on an object returns `{}` as is, without the inner defaults. Use `.prefault({})`, which parses `{}` and so fills them.
- **Connect messages carry `$typeName`**: a request object has an extra `$typeName` key on every message. Code iterating over its keys must skip it; zod strips it when parsing.
- **Summary and history are TypeScript**: `domain/shares/summary.ts` (the glossary's rules, in order) and `domain/shares/history.ts` (filters and pagination over the whole history). Fine for one person's history; move them to SQL if it grows past a few thousand Shares.
- **Testing background work**: `apps/server/src/domain/shares/test-helpers.ts` has `until()` (poll a condition) and `deferred()` (end an Identification when the test decides). Never `sleep` a fixed time.
- **TMDB client is generated by Orval** from TMDB's OpenAPI spec: typed functions in `src/integrations/tmdb/gen/tmdb.ts`, typed fake answers in `src/integrations/tmdb/gen/tmdb.faker.ts`. TMDB's spec marks no field required, leaves `tv_results` untyped and describes only the 200 answer: `src/integrations/tmdb/client.ts` handles those gaps in one place.
- **Seerr's spec does not match its answers** (same on v3.5.0, main, develop: `watchProviders` nesting, nullable `modifiedBy`…). Orval generates its client and fakes from the spec pinned to v3.5.0, without zod validation of answers. Its address being a setting, every generated call goes through `integrations/seerr/seerr-fetch.ts` (an Orval "mutator") with `{ seerr: { url, apiKey } }` in its options.
- **openapi-typescript does not run with TypeScript 7** (it drives the compiler API, gone in 7). Orval does not need it.
- **MSW 3 does not intercept fetch under Bun 1.4** ("Failed to replace a global value"). Tests fake `fetch` with `spyOn` instead: `src/integrations/tmdb/fake-fetch.ts`, undone by `mock.restore()`.
- **yt-dlp on Instagram**: format selectors with conditions (`worst[ext=mp4]`) fail, because Instagram announces neither size nor resolution. Plain `--format worst` works. YouTube offers no file with both sound and picture: the selector falls back to `wv[height>=360][width>=360]+wa` (width too, a Short being vertical), merged by ffmpeg. YouTube also needs a JavaScript runtime: `--js-runtimes bun`, yt-dlp only looks for Deno by default. Public reels need no cookies: the cookies.txt setting was removed on 2026-10-12, to come back only if private reels or a login wall show up.
- **Instagram photo posts**: yt-dlp only reads videos and answers "There is no video in this post"; on that exact message (`isNoVideoError`, kept inside `integrations/ytdlp`) `readVideo` returns `undefined`, and `readLink` (`extractors/link.ts`) calls `readPhoto` (`extractors/photo.ts`) instead. A `Photo` is not a `Video`: one picture for the LLM, no sound, no frames kept. `integrations/instagram/post.ts` reads the public page's Open Graph tags (caption and author from `og:title`, first picture from `og:image`, 640 px square crop). From some addresses (cloud machines) yt-dlp answers "Instagram sent an empty media response" instead, for photos and reels alike: no fallback then. Attribute values come HTML-escaped (`&quot;`, `&#064;`) and Bun's `HTMLRewriter` does not decode them: `post.ts` does.
- **Programs are run through `integrations/process.ts`**: one place for timeouts and error messages. Tests use the real ffmpeg on `integrations/ffmpeg/fixtures/test-pattern.mp4`; yt-dlp is never run in tests (no network), only its recorded JSON is parsed.
- **Integrations take plain config, never a repository**: `new Tmdb({ token, language })`, `chat(config, messages)`. `src/index.ts` reads the settings once per Identification and hands each integration its part.
- **Errors are `SpotarrError`s** (`src/errors.ts`): one class, six codes (`invalid_input`, `not_found`, `busy`, `not_configured`, `unavailable`, `timeout`). Never `throw new Error(...)` in production code; integrations turn their failures (status, network, timeout) into a code and a message naming the service. `api/rpc/errors.ts` maps codes to Connect codes for the UI; zod errors become `invalid_argument`; anything else is `internal` and logged.
- **LLM answers are typed by structured outputs**: `chat(config, messages, schema)` sends the zod schema as a strict JSON schema (`zodResponseFormat`) and returns the parsed object. Never describe the JSON format in a prompt. In a strict schema every field is required: use `.nullable()`, not `.optional()`, and `.describe()` to explain a field to the model.
- **Live checks use the gitignored `.env`** at the repo root (OpenRouter key, TMDB token, Seerr). Spotarr itself never reads it; push the values into a dev server with `UpdateSettings`. Never print them.
- **knip** reports code nobody uses. Its `knip.json` declares what it cannot see: the entry points (scripts, migrations, the Shortcut's build), `protoc-gen-es` (run by buf), and macOS's `plutil` and `shortcuts`. Generated code and `apps/ios` are ignored. An export used only in its own file is reported: drop the `export`.
- **`pnpm exec biome`** may print an odd "ESLint output" line from a shell hook; use `pnpm lint` / `pnpm format`.
- **Agent skills** come from skills.sh: `npx skills add <owner/repo> -s <skill> -a claude-code -y` copies one into `.claude/skills/` and records it in `skills-lock.json`; `npx skills update` refreshes them. Biome skips `.claude/skills` (third-party files, e.g. an SVG failing `noSvgWithoutTitle`).

## Versions

Pinned at the latest stable on 2026-10-12 and bumped weekly by Renovate: pnpm 12.11.2, Bun 1.4.3, TypeScript 7.0.2, Biome 2.5.15, buf 1.73.0, protobuf-es 2.16.0, style-dictionary 5.6.1, kysely 0.29.6, kysely-codegen 0.20.0, hono 4.13.13, @connectrpc/connect 2.2.0, zod 4.6.6. If a newer version breaks another tool, keep the newest that works and note it here.
