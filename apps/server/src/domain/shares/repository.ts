import { type Kysely, sql, type Updateable } from "kysely";
import type { DB } from "../../db";
import type { Shares } from "../../db/gen/types";
import { summaryOf } from "./summary";
import {
  type Addition,
  type Candidate,
  CandidateSchema,
  CluesSchema,
  type IdentificationResult,
  type IdentificationStatus,
  type Method,
  type Share,
  type ShareInput,
} from "./types";

type MonthStats = {
  month: string;
  shares: number;
  identified: number;
  noMatch: number;
  failed: number;
  additions: number;
  automaticAdditions: number;
  llmCostUsd: number;
};
type AddedTitle = Pick<Candidate, "type" | "title" | "year" | "posterUrl"> & {
  shareId: string;
  automatic: boolean;
};
export type Stats = {
  months: MonthStats[];
  sources: { source: string; shares: number }[];
  moviesAdded: number;
  showsAdded: number;
  recentlyAdded: AddedTitle[];
  authors: { author: string; source: string; shares: number; identified: number }[];
};

// How many authors the stats page ranks.
const TOP_AUTHORS = 5;

// How many posters the stats page stacks in its Added tile.
const RECENTLY_ADDED = 5;

const NOW = sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// Every column but the image, which is only read by the Identification (see input()).
const COLUMNS = [
  "id",
  "created_at",
  "input_url",
  "input_text",
  "source",
  "status",
  "method",
  "duration_ms",
  "extractors",
  "clues",
  "reasoning",
  "candidates",
  "error",
] as const;

export class ShareRepository {
  constructor(private readonly db: Kysely<DB>) {}

  // Returns the new Share's id. UUIDv7 starts with a timestamp, so ids sort by creation time.
  async create(input: ShareInput, source: string): Promise<string> {
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
    return id;
  }

  async get(id: string): Promise<Share | undefined> {
    const row = await this.db
      .selectFrom("shares")
      .select(COLUMNS)
      .select(sql<number>`input_image IS NOT NULL`.as("has_image"))
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return undefined;

    const additions = await this.db
      .selectFrom("additions")
      .selectAll()
      .where("share_id", "=", id)
      .orderBy("id")
      .execute();
    const frames = await this.db
      .selectFrom("frames")
      .select(["share_id", "position", "at_ms"])
      .where("share_id", "=", id)
      .orderBy("position")
      .execute();
    return toShare(row, additions, frames);
  }

  // The whole history, newest first.
  // ponytail: loads every Share; paginate in SQL if the history grows past a few thousand.
  async all(): Promise<Share[]> {
    const rows = await this.db
      .selectFrom("shares")
      .select(COLUMNS)
      .select(sql<number>`input_image IS NOT NULL`.as("has_image"))
      .orderBy("id", "desc")
      .execute();
    const additions = await this.db.selectFrom("additions").selectAll().orderBy("id").execute();
    const frames = await this.db
      .selectFrom("frames")
      .select(["share_id", "position", "at_ms"])
      .orderBy("position")
      .execute();
    return rows.map((row) =>
      toShare(
        row,
        additions.filter((a) => a.share_id === row.id),
        frames.filter((f) => f.share_id === row.id),
      ),
    );
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
      .set({ status: "PROCESSING", updated_at: NOW })
      .where("id", "=", (eb) =>
        eb.selectFrom("shares").select("id").where("status", "=", "QUEUED").orderBy("id").limit(1),
      )
      .returning("id")
      .executeTakeFirst();
    return row?.id;
  }

  // Stores what the Identification found, and replaces the video's thumbnails,
  // in one transaction: a crash halfway leaves the Share as it was.
  async finish(id: string, result: IdentificationResult, durationMs: number): Promise<void> {
    // Validated first: an invalid result throws before anything is written.
    const clues = JSON.stringify(CluesSchema.parse(result.clues));
    const candidates = JSON.stringify(CandidateSchema.array().parse(result.candidates));
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("frames").where("share_id", "=", id).execute();
      for (const [position, frame] of (result.frames ?? []).entries()) {
        await trx
          .insertInto("frames")
          .values({ share_id: id, position, at_ms: frame.atMs, thumbnail: frame.thumbnail })
          .execute();
      }
      await this.update(
        id,
        {
          status: result.status,
          method: result.method ?? null,
          duration_ms: durationMs,
          extractors: JSON.stringify(result.extractors),
          clues,
          reasoning: result.reasoning ?? null,
          candidates,
          llm_cost_usd: result.llmCostUsd ?? null,
          error: null,
        },
        trx,
      );
    });
  }

  async fail(id: string, error: string, durationMs: number): Promise<void> {
    await this.update(id, { status: "FAILED", duration_ms: durationMs, error });
  }

  // Puts a Share back in the queue, clearing what its Identification found. Additions stay.
  async requeue(id: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx.deleteFrom("frames").where("share_id", "=", id).execute();
      await this.update(
        id,
        {
          status: "QUEUED",
          method: null,
          duration_ms: null,
          extractors: "[]",
          clues: "{}",
          reasoning: null,
          candidates: "[]",
          llm_cost_usd: null,
          error: null,
        },
        trx,
      );
    });
  }

  // What the LLM cost for the Shares of the last 30 days, counting only the
  // Identifications whose cost is known.
  async llmCostLast30Days(): Promise<{ identifications: number; totalUsd: number }> {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const row = await this.db
      .selectFrom("shares")
      .select((eb) => [
        eb.fn.count<number>("llm_cost_usd").as("identifications"),
        eb.fn.sum<number>("llm_cost_usd").as("totalUsd"),
      ])
      .where("created_at", ">=", since)
      .executeTakeFirstOrThrow();
    return { identifications: row.identifications, totalUsd: row.totalUsd ?? 0 };
  }

  // Shares and Additions counted by month ("2026-10", from the ISO date), oldest
  // first, and Shares by source. Counted by SQLite: no Share is loaded.
  async stats(): Promise<Stats> {
    const shareMonths = await this.db
      .selectFrom("shares")
      .select((eb) => [
        sql<string>`substr(created_at, 1, 7)`.as("month"),
        eb.fn.countAll<number>().as("shares"),
        sql<number>`count(*) filter (where status = 'READY')`.as("identified"),
        sql<number>`count(*) filter (where status = 'NO_MATCH')`.as("noMatch"),
        sql<number>`count(*) filter (where status = 'FAILED')`.as("failed"),
        eb.fn.sum<number>("llm_cost_usd").as("llmCostUsd"),
      ])
      .groupBy("month")
      .execute();
    const additionMonths = await this.db
      .selectFrom("additions")
      .select((eb) => [
        sql<string>`substr(created_at, 1, 7)`.as("month"),
        eb.fn.countAll<number>().as("additions"),
        sql<number>`count(*) filter (where automatic = 1)`.as("automaticAdditions"),
      ])
      .where("status", "!=", "FAILED")
      .groupBy("month")
      .execute();
    const sources = await this.db
      .selectFrom("shares")
      .select((eb) => [
        eb.fn.coalesce("source", sql<string>`'unknown'`).as("source"),
        eb.fn.countAll<number>().as("shares"),
      ])
      .groupBy("source")
      .orderBy("shares", "desc")
      .execute();

    const byType = await this.db
      .selectFrom("additions")
      .select(["media_type", (eb) => eb.fn.countAll<number>().as("count")])
      .where("status", "!=", "FAILED")
      .groupBy("media_type")
      .execute();
    // The Addition only keeps the TMDB id: title and poster come from the
    // Share's Candidate it was made from.
    const recent = await this.db
      .selectFrom("additions")
      .innerJoin("shares", "shares.id", "additions.share_id")
      .select([
        "additions.share_id",
        "additions.tmdb_id",
        "additions.media_type",
        "additions.automatic",
        "shares.candidates",
      ])
      .where("additions.status", "!=", "FAILED")
      .orderBy("additions.created_at", "desc")
      .limit(RECENTLY_ADDED)
      .execute();
    const recentlyAdded: AddedTitle[] = [];
    for (const row of recent) {
      const candidates = CandidateSchema.array().parse(JSON.parse(row.candidates));
      const candidate = candidates.find(
        (c) => c.tmdbId === row.tmdb_id && c.type === row.media_type,
      );
      if (!candidate) continue;
      recentlyAdded.push({
        shareId: row.share_id,
        type: candidate.type,
        title: candidate.title,
        year: candidate.year,
        posterUrl: candidate.posterUrl,
        automatic: row.automatic === 1,
      });
    }

    // The author is a Clue, read by yt-dlp from the shared video.
    const author = sql<string>`json_extract(clues, '$.author')`;
    const authors = await this.db
      .selectFrom("shares")
      .select((eb) => [
        author.as("author"),
        eb.fn.coalesce("source", sql<string>`''`).as("source"),
        eb.fn.countAll<number>().as("shares"),
        sql<number>`count(*) filter (where status = 'READY')`.as("identified"),
      ])
      .where(author, "is not", null)
      .groupBy(["author", "source"])
      .orderBy("shares", "desc")
      .limit(TOP_AUTHORS)
      .execute();

    // A month may have Additions without Shares (a Share from the month before).
    const months = new Map<string, MonthStats>();
    for (const row of shareMonths) {
      months.set(row.month, {
        ...row,
        llmCostUsd: row.llmCostUsd ?? 0,
        additions: 0,
        automaticAdditions: 0,
      });
    }
    for (const row of additionMonths) {
      const month = months.get(row.month) ?? {
        month: row.month,
        shares: 0,
        identified: 0,
        noMatch: 0,
        failed: 0,
        llmCostUsd: 0,
      };
      months.set(row.month, { ...month, ...row });
    }
    return {
      months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
      sources,
      moviesAdded: byType.find((row) => row.media_type === "MOVIE")?.count ?? 0,
      showsAdded: byType.find((row) => row.media_type === "TV")?.count ?? 0,
      recentlyAdded,
      authors,
    };
  }

  // Records what happened when adding a Candidate. Returns nothing: read the Share again.
  async addAddition(
    shareId: string,
    addition: Pick<Addition, "tmdbId" | "type" | "target" | "status" | "error" | "automatic">,
  ): Promise<void> {
    await this.db
      .insertInto("additions")
      .values({
        id: `add_${Bun.randomUUIDv7()}`,
        share_id: shareId,
        tmdb_id: addition.tmdbId,
        media_type: addition.type,
        target: addition.target,
        status: addition.status,
        error: addition.error ?? null,
        automatic: addition.automatic ? 1 : 0,
      })
      .execute();
  }

  // One thumbnail of a shared video, as JPEG.
  async frameThumbnail(shareId: string, position: number): Promise<Uint8Array | undefined> {
    const row = await this.db
      .selectFrom("frames")
      .select("thumbnail")
      .where("share_id", "=", shareId)
      .where("position", "=", position)
      .executeTakeFirst();
    return row?.thumbnail;
  }

  // At startup: Identifications cut short by a restart start over.
  async requeueInterrupted(): Promise<void> {
    await this.db
      .updateTable("shares")
      .set({ status: "QUEUED", updated_at: NOW })
      .where("status", "=", "PROCESSING")
      .execute();
  }

  // `db` is a transaction when the update goes with other writes.
  private async update(
    id: string,
    values: Updateable<Shares>,
    db: Kysely<DB> = this.db,
  ): Promise<void> {
    await db
      .updateTable("shares")
      .set({ ...values, updated_at: NOW })
      .where("id", "=", id)
      .execute();
  }
}

type ShareRow = {
  id: string;
  created_at: string;
  input_url: string | null;
  input_text: string | null;
  has_image: number;
  source: string | null;
  status: string;
  method: string | null;
  duration_ms: number | null;
  extractors: string;
  clues: string;
  reasoning: string | null;
  candidates: string;
  error: string | null;
};

type AdditionRow = {
  id: string;
  created_at: string;
  tmdb_id: number;
  media_type: string;
  target: string;
  status: string;
  error: string | null;
  automatic: number;
};

// SQLite stores enums as text and lists as JSON: this turns a row back into a Share.
type FrameRow = { position: number; at_ms: number };

function toShare(row: ShareRow, additionRows: AdditionRow[], frameRows: FrameRow[]): Share {
  const status = row.status as IdentificationStatus;
  const candidates = CandidateSchema.array().parse(JSON.parse(row.candidates));
  const additions = additionRows.map(toAddition);

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
      status,
      method: (row.method as Method | null) ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      extractors: JSON.parse(row.extractors),
      clues: CluesSchema.parse(JSON.parse(row.clues)),
      reasoning: row.reasoning ?? undefined,
      error: row.error ?? undefined,
    },
    candidates,
    additions,
    frames: frameRows.map((f) => ({ position: f.position, atMs: f.at_ms })),
    summary: summaryOf(status, candidates, additions),
  };
}

function toAddition(row: AdditionRow): Addition {
  return {
    id: row.id,
    createdAt: row.created_at,
    tmdbId: row.tmdb_id,
    type: row.media_type as Addition["type"],
    target: row.target as Addition["target"],
    status: row.status as Addition["status"],
    error: row.error ?? undefined,
    automatic: row.automatic === 1,
  };
}
