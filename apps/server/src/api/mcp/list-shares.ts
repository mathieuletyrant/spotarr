import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShareRepository } from "../../domain/shares/repository";
import { candidateStatusOf } from "../../domain/shares/rules/summary";
import type { Share } from "../../domain/shares/types";
import { listHistory } from "../../domain/shares/use-cases/list-history";

const SUMMARIES = [
  "IN_PROGRESS",
  "TO_CHOOSE",
  "ADDED",
  "REQUESTED",
  "ALREADY_PRESENT",
  "NO_MATCH",
  "FAILED",
] as const;

// What the MCP client sends; the same filters as the ListShares RPC. The
// descriptions are all an LLM knows of each field: they say what to put.
const ListSharesInput = {
  genres: z
    .array(z.string())
    .optional()
    .describe(
      'Only the Shares with at least one Candidate of one of these genres. Use the exact names list_genres gives, in Spotarr\'s language: ["Comédie"], not ["Comedy"].',
    ),
  keywords: z
    .array(z.string())
    .optional()
    .describe(
      'Only the Shares with at least one Candidate tagged with one of these keywords. Use the exact names list_keywords gives, in English: ["based on novel or book"].',
    ),
  query: z
    .string()
    .optional()
    .describe(
      'A word or a title, searched as is (case-insensitive, not by meaning) in the shared URL and text, the source ("instagram.com") and the Candidates\' titles, genres and keywords. E.g. "Dune" or "tiktok". Not a sentence: "a funny movie" matches nothing.',
    ),
  summaries: z
    .array(z.enum(SUMMARIES))
    .optional()
    .describe(`Only the Shares whose summary is one of these; all when absent. A Share's summary:
- TO_CHOOSE: identified, nothing added yet; the user has not picked a Candidate.
- REQUESTED: a Candidate was requested through Seerr; it is or will be in the library.
- ALREADY_PRESENT: the library already had the best Candidate, or the one picked.
- ADDED: a Candidate was added to Radarr or Sonarr directly (not used yet).
- NO_MATCH: no movie or TV show was found.
- FAILED: the identification or the latest request failed.
- IN_PROGRESS: still being identified; no Candidates yet.
E.g. ["TO_CHOOSE"] for what was shared but never added.`),
  pageSize: z
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("How many Shares per page, 1 to 100; 50 when absent."),
  cursor: z
    .string()
    .optional()
    .describe(
      'For the next page: the "nextCursor" of the previous answer, with the same filters. Absent for the first page; an answer without "nextCursor" is the last page.',
    ),
};

const DESCRIPTION = `Lists what the user shared to Spotarr (links to videos, articles or films' pages, screenshots, text), newest first, with the movies and TV shows each Share was identified as. Read-only. Filters combine: a Share must pass all of them.

Each Share holds its Candidates: the works Spotarr's identification guessed, best first, with a confidence from 0 to 1. One Share often has several guesses, of which one or none is right. A Candidate carries its TMDB type (MOVIE or TV), year, genres, keywords (TMDB's tags, in English: "detective"), rating out of 10 and votes, overview (the synopsis), and:
- status, where it stands now: REQUESTED when it was requested through Seerr (from this Share, or already before), ADDED when added to Radarr or Sonarr directly (not used yet), ALREADY_PRESENT when it is in the library (all or some seasons), CAN_ADD when it is not in the library.
- libraryState: where the library stands, as Seerr last reported: ABSENT, REQUESTED, PARTIAL (some seasons) or AVAILABLE.`;

export function registerListShares(server: McpServer, shares: ShareRepository): void {
  server.registerTool(
    "list_shares",
    {
      title: "List Spotarr's Shares",
      description: DESCRIPTION,
      inputSchema: ListSharesInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      const page = await listHistory(
        {
          limit: input.pageSize,
          cursor: input.cursor,
          summaries: input.summaries ?? [],
          query: input.query?.trim(),
          genres: input.genres,
          keywords: input.keywords,
        },
        { shares },
      );
      const answer = { shares: page.shares.map(shareForMcp), nextCursor: page.nextCursor };
      return { content: [{ type: "text", text: JSON.stringify(answer) }] };
    },
  );
}

// A Share as the History shows it, in plain JSON for an LLM: names rather than
// the contract's enum numbers, and nothing it cannot use (frames, Additions).
function shareForMcp(share: Share) {
  return {
    id: share.id,
    sharedAt: share.createdAt,
    source: share.source,
    url: share.input.url,
    text: share.input.text,
    author: share.identification.clues.author,
    summary: share.summary,
    candidates: share.candidates.map((candidate) => ({
      tmdbId: candidate.tmdbId,
      type: candidate.type,
      title: candidate.title,
      originalTitle: candidate.originalTitle,
      year: candidate.year,
      genres: candidate.genres,
      keywords: candidate.keywords,
      tmdbRating: candidate.tmdbRating,
      tmdbVotes: candidate.tmdbVotes,
      overview: candidate.overview,
      confidence: candidate.confidence,
      status: candidateStatusOf(candidate, share.additions).status,
      libraryState: candidate.libraryState,
    })),
  };
}
