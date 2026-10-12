import { type Kysely, type Selectable, sql } from "kysely";
import type { DB } from "../db";
import type { Additions, Shares } from "../db/gen/types";
import {
  type Addition,
  CandidateSchema,
  CluesSchema,
  type IdentificationResult,
  type Share,
  type ShareInput,
  type Summary,
} from "./types";

// The Summary of a Share, computed by SQLite so the history can both show it
// and filter on it. Order matters: the first matching line wins.
const summary = sql<Summary>`CASE
  WHEN shares.status IN ('QUEUED', 'PROCESSING') THEN 'IN_PROGRESS'
  WHEN latest_addition.status IS NOT NULL THEN latest_addition.status
  WHEN shares.status = 'FAILED' THEN 'FAILED'
  WHEN shares.status = 'NO_MATCH' THEN 'NO_MATCH'
  WHEN json_extract(shares.candidates, '$[0].libraryState') IN ('AVAILABLE', 'PARTIAL') THEN 'ALREADY_PRESENT'
  ELSE 'TO_CHOOSE'
END`;

export type ListOptions = { limit: number; after?: string; summaries: Summary[]; query?: string };

export class ShareRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async create(input: ShareInput, source: string): Promise<Share> {
    // UUIDv7 starts with a timestamp: ids sort by creation time, which lets
    // the history paginate on the id alone.
    const id = `shr_${Bun.randomUUIDv7()}`;
    await this.db
      .insertInto("shares")
      .values({
        id,
        source,
        input_url: input.url ?? null,
        input_text: input.text ?? null,
        input_image: input.image ?? null,
      })
      .execute();
    return (await this.get(id)) as Share;
  }

  async get(id: string): Promise<Share | undefined> {
    const [share] = await this.select((q) => q.where("shares.id", "=", id));
    return share;
  }

  // Newest first. `after` is the id of the last Share of the previous page.
  async list({ limit, after, summaries, query }: ListOptions): Promise<Share[]> {
    return this.select((q) => {
      let page = q.orderBy("shares.id", "desc").limit(limit);
      if (after) page = page.where("shares.id", "<", after);
      if (summaries.length > 0) page = page.where(summary, "in", summaries);
      if (query) {
        const like = `%${query}%`;
        page = page.where((eb) =>
          eb.or([
            eb("shares.source", "like", like),
            eb("shares.input_url", "like", like),
            eb("shares.input_text", "like", like),
            eb("shares.candidates", "like", like),
          ]),
        );
      }
      return page;
    });
  }

  // What the Identification works on, image included.
  async input(id: string): Promise<ShareInput> {
    const row = await this.db
      .selectFrom("shares")
      .select(["input_url", "input_text", "input_image"])
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return {
      url: row.input_url ?? undefined,
      text: row.input_text ?? undefined,
      image: row.input_image ?? undefined,
    };
  }

  // Moves the oldest QUEUED Share to PROCESSING and returns its id, in one statement.
  async claimNext(): Promise<string | undefined> {
    const row = await this.db
      .updateTable("shares")
      .set({ status: "PROCESSING", updated_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
      .where("id", "=", (eb) =>
        eb.selectFrom("shares").select("id").where("status", "=", "QUEUED").orderBy("id").limit(1),
      )
      .returning("id")
      .executeTakeFirst();
    return row?.id;
  }

  async finish(id: string, result: IdentificationResult, durationMs: number): Promise<void> {
    await this.update(id, {
      status: result.status,
      method: result.method ?? null,
      duration_ms: durationMs,
      extractors: JSON.stringify(result.extractors),
      clues: JSON.stringify(CluesSchema.parse(result.clues)),
      reasoning: result.reasoning ?? null,
      candidates: JSON.stringify(CandidateSchema.array().parse(result.candidates)),
      error: null,
    });
  }

  async fail(id: string, error: string, durationMs: number): Promise<void> {
    await this.update(id, { status: "FAILED", duration_ms: durationMs, error });
  }

  // Puts a finished Share back in the queue, clearing what its Identification
  // found. Additions are kept. "busy" when it is still queued or processing.
  async requeue(id: string): Promise<"queued" | "busy" | "missing"> {
    const share = await this.get(id);
    if (!share) return "missing";
    if (share.summary === "IN_PROGRESS") return "busy";
    await this.update(id, {
      status: "QUEUED",
      method: null,
      duration_ms: null,
      extractors: "[]",
      clues: "{}",
      reasoning: null,
      candidates: "[]",
      error: null,
    });
    return "queued";
  }

  // At startup: Identifications cut short by a restart start over.
  async requeueInterrupted(): Promise<void> {
    await this.db
      .updateTable("shares")
      .set({ status: "QUEUED" })
      .where("status", "=", "PROCESSING")
      .execute();
  }

  private async update(
    id: string,
    values: Partial<Omit<Selectable<Shares>, "id" | "created_at">>,
  ): Promise<void> {
    await this.db
      .updateTable("shares")
      .set({ ...values, updated_at: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))` })
      .where("id", "=", id)
      .execute();
  }

  // One query for the Shares, one for all their Additions.
  private async select(narrow: (query: ShareQuery) => ShareQuery): Promise<Share[]> {
    const rows = await narrow(shareQuery(this.db)).execute();
    if (rows.length === 0) return [];

    const additions = await this.db
      .selectFrom("additions")
      .selectAll()
      .where(
        "share_id",
        "in",
        rows.map((r) => r.id),
      )
      .orderBy("id")
      .execute();
    return rows.map((row) =>
      toShare(
        row,
        additions.filter((a) => a.share_id === row.id),
      ),
    );
  }
}

// Every column a Share needs, plus its Summary. Kysely infers the row type from it.
function shareQuery(db: Kysely<DB>) {
  return db
    .selectFrom("shares")
    .leftJoin(
      (eb) =>
        eb
          .selectFrom("additions")
          .select(["share_id", "status"])
          .where("id", "in", (sub) =>
            sub
              .selectFrom("additions")
              .select((e) => e.fn.max("id").as("id"))
              .groupBy("share_id"),
          )
          .as("latest_addition"),
      (join) => join.onRef("latest_addition.share_id", "=", "shares.id"),
    )
    .select([
      "shares.id",
      "shares.created_at",
      "shares.input_url",
      "shares.input_text",
      sql<number>`shares.input_image IS NOT NULL`.as("has_image"),
      "shares.source",
      "shares.status",
      "shares.method",
      "shares.duration_ms",
      "shares.extractors",
      "shares.clues",
      "shares.reasoning",
      "shares.candidates",
      "shares.error",
      summary.as("summary"),
    ]);
}

type ShareQuery = ReturnType<typeof shareQuery>;
type ShareRow = Awaited<ReturnType<ShareQuery["execute"]>>[number];

function toShare(row: ShareRow, additions: Selectable<Additions>[]): Share {
  return {
    id: row.id,
    createdAt: row.created_at,
    input: {
      url: row.input_url ?? undefined,
      text: row.input_text ?? undefined,
      hasImage: row.has_image === 1,
    },
    source: row.source ?? "",
    identification: {
      status: row.status as Share["identification"]["status"],
      method: (row.method ?? undefined) as Share["identification"]["method"],
      durationMs: row.duration_ms ?? undefined,
      extractors: JSON.parse(row.extractors),
      clues: CluesSchema.parse(JSON.parse(row.clues)),
      reasoning: row.reasoning ?? undefined,
      error: row.error ?? undefined,
    },
    candidates: CandidateSchema.array().parse(JSON.parse(row.candidates)),
    additions: additions.map(
      (a): Addition => ({
        id: a.id,
        createdAt: a.created_at,
        tmdbId: a.tmdb_id,
        type: a.media_type as Addition["type"],
        target: a.target as Addition["target"],
        status: a.status as Addition["status"],
        error: a.error ?? undefined,
      }),
    ),
    summary: row.summary,
  };
}
