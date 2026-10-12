# AGENTS.md

Project memory for humans and coding agents. Keep it current: a trap found while working goes here, in the PR that found it.

## What Spotarr is

Self-hosted personal service (Docker; also in Mathieu's Umbrel community store): an iOS share (reel, link, screenshot, text) is identified as a movie or TV show in the background, then added to the library through Seerr once Mathieu picks a candidate in the history. One user, one server. Vocabulary: [GLOSSARY.md](./GLOSSARY.md). Decisions: [docs/adr/](./docs/adr/).

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install exactly what the lockfile says |
| `pnpm check` | The whole gate: Biome → `buf lint` → generate (contract, tokens) → stale-output guard → `buf breaking` → `tsc` → `bun test` |
| `pnpm format` | Rewrite files to Biome's format |
| `pnpm generate` | Regenerate `packages/contract/src/gen` and `packages/design-tokens/gen` |
| `pnpm dev` | Run the service on :3000 with its data in `./data`; the API token is printed at first start |

## Layout

- `packages/contract`: `proto/spotarr/v1/spotarr.proto` is the single source of the API. Generated TypeScript lives in `src/gen`, committed, re-exported by `@spotarr/contract`.
- `packages/design-tokens`: `tokens.json` is the single source of style. `build.ts` emits `gen/tokens.css` (`:root` light, `.dark` dark).
- `apps/server`: Hono on Bun, Connect-RPC under `/api`, SQLite in `DATA_DIR`. `src/app.ts` only assembles the routes; RPC handlers live in `src/rpc/<domain>.ts`, one file per domain, typed with `Rpcs<"methodName">` from `src/rpc/types.ts`. A new RPC goes in its domain file, then is spread into `router.service` in `app.ts`. Errors shared by all RPCs (zod → `invalid_argument`) are interceptors in `src/rpc/errors.ts`. Domain code lives by domain: `src/settings/`, `src/shares/` (types, input validation, repository, queue), `src/identification/`. Repositories are the only code that sees Kysely; they take and return domain types. `src/db`: dialect, dated migrations, `openDatabase()`; `src/db/gen/types.ts` is generated from the migrated schema.
- `apps/web`, `apps/ios`, `umbrel/`: arrive with their milestones.

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
- SQLite from milestone 1. No history purge, no `VACUUM INTO`. Design tokens from milestone 0; macOS CI job only with the SwiftUI app.

## Known traps

- **pnpm 12 build scripts**: `onlyBuiltDependencies` is ignored; approve scripts with `allowBuilds` in `pnpm-workspace.yaml`, else `pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS`.
- **`pnpm -r <name>` with no such script**: pnpm falls back to `exec <name>` and fails. Only add a root script once a package implements it.
- **Biome 2.5 config keys**: `linter.rules.preset` (not `recommended`), `vcs.useIgnoreFile` (singular).
- **Stale generated output**: `pnpm check` regenerates and fails if `**/gen/**` differs from what is committed. Run `pnpm generate` and commit. On a brand-new generated file the guard also fails until the file is committed once. The guard is `scripts/check-generated.ts`.
- **`buf breaking`** compares against `main` on GitHub over the network; it needs the repo to stay public (or a token later).
- **Style Dictionary collision warning**: light and dark tokens share one CSS name on purpose; `log.warnings` is disabled in `build.ts` for that reason.
- **Kysely 0.29 moved migrations**: `Migrator` and `Migration` come from `kysely/migration`, not `kysely`. The root import fails at runtime with "Export named 'Migrator' not found".
- **kysely-codegen CLI**: its bun:sqlite path needs `kysely-bun-sqlite`, the broken dialect. `apps/server/scripts/codegen.ts` calls `generate()` with our own Kysely instance instead.
- **SQLite TEXT primary keys accept NULL** unless declared `notNull()`; the generated type then reads `string | null`.
- **zod 4 object defaults**: `.default({})` on an object returns `{}` as is, without the inner defaults. Use `.prefault({})`, which parses `{}` and so fills them.
- **Connect messages carry `$typeName`**: a request object has an extra `$typeName` key on every message. Code iterating over its keys must skip it; zod strips it when parsing.
- **Summary is SQL**: the Summary of a Share is one `CASE` expression in `src/shares/repository.ts`, used both to show it and to filter on it. Change the rules there only.
- **Testing background work**: `src/shares/test-helpers.ts` has `until()` (poll a condition) and `deferred()` (end an Identification when the test decides). Never `sleep` a fixed time.
- **`pnpm exec biome`** may print an odd "ESLint output" line from a shell hook; use `pnpm lint` / `pnpm format`.

## Versions

Pinned at the latest stable on 2026-10-12 and bumped weekly by Renovate: pnpm 12.11.2, Bun 1.4.3, TypeScript 7.0.2, Biome 2.5.15, buf 1.73.0, protobuf-es 2.16.0, style-dictionary 5.6.1, kysely 0.29.6, kysely-codegen 0.20.0, hono 4.13.13, @connectrpc/connect 2.2.0, zod 4.6.6. If a newer version breaks another tool, keep the newest that works and note it here.
