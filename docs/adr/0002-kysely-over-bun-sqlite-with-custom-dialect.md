# Use Kysely over `bun:sqlite` through a hand-written dialect, no ORM

Persistence is a single SQLite file in `/data`, read through Kysely (typed query builder, migrations, kysely-codegen types checked in CI) and accessed only from repositories, so the rest of the code never sees Kysely. The community dialect `kysely-bun-sqlite` (0.4.0) no longer works with Kysely 0.29: `SELECT`s return nothing, silently, because `bun:sqlite` lacks the `reader` property Kysely expects. A ~20-line in-house dialect fixes that and is the only Kysely-specific code outside the repositories. An ORM (Drizzle, Prisma) was rejected: queries should read like the SQL they produce, for a learner and for agents.

## Consequences

- Migrations are dated files run by Kysely's `Migrator` at startup and frozen once applied.
- WAL mode is on so the background queue writes while the UI reads.
- Repositories are tested against a real in-memory SQLite rebuilt by the migrations for each test.
