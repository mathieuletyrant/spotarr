import type { Kysely } from "kysely";

// A Candidate's status now follows its Library state alone, which Seerr keeps
// current. Until now the Library state was only checked at the Identification,
// and an Addition stood in for it: a title requested or found already present
// since still reads ABSENT. Each such Candidate, in every Share, gets the
// state its title's latest Addition implies, so nothing reads "Can add" again.
// biome-ignore lint/suspicious/noExplicitAny: migrations see the schema as it was
export async function up(db: Kysely<any>): Promise<void> {
  const additions = await db
    .selectFrom("additions")
    .select(["tmdb_id", "media_type", "status"])
    .orderBy("id")
    .execute();
  // "MOVIE 550" → "REQUESTED"; a later Addition replaces an earlier one.
  const stateOf = new Map<string, string>();
  for (const addition of additions) {
    const key = `${addition.media_type} ${addition.tmdb_id}`;
    if (addition.status === "REQUESTED" || addition.status === "ADDED") {
      stateOf.set(key, "REQUESTED");
    }
    if (addition.status === "ALREADY_PRESENT") stateOf.set(key, "AVAILABLE");
  }
  if (stateOf.size === 0) return;

  const shares = await db.selectFrom("shares").select(["id", "candidates"]).execute();
  for (const share of shares) {
    const candidates = JSON.parse(share.candidates);
    let changed = false;
    for (const candidate of candidates) {
      const state = stateOf.get(`${candidate.type} ${candidate.tmdbId}`);
      if (state && candidate.libraryState === "ABSENT") {
        candidate.libraryState = state;
        changed = true;
      }
    }
    if (!changed) continue;
    await db
      .updateTable("shares")
      .set({ candidates: JSON.stringify(candidates) })
      .where("id", "=", share.id)
      .execute();
  }
}
