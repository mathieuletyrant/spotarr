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

// What the MCP client sends; the same filters as the ListShares RPC.
const ListSharesInput = {
  genres: z
    .array(z.string())
    .optional()
    .describe(
      'Only the Shares with a Candidate of one of these genres, named as TMDB names them in Spotarr\'s language ("Comédie", not "Comedy"). Every answer lists the genres that exist.',
    ),
  query: z
    .string()
    .optional()
    .describe("Text searched in the source, the shared URL and text, the titles and genres."),
  summaries: z
    .array(z.enum(SUMMARIES))
    .optional()
    .describe("Only these Summaries; all when absent."),
  pageSize: z.int().min(1).max(100).optional().describe("Shares per page: 50 when absent."),
  cursor: z.string().optional().describe("The nextCursor of the previous page."),
};

const DESCRIPTION = `Lists what the user shared to Spotarr (Instagram reels, links, screenshots), newest first, with the movies and TV shows each Share was identified as. Read-only.

Each Share holds its Candidates: the works Spotarr's identification guessed, best first, with a confidence from 0 to 1. One reel often has several guesses, of which one or none is right. A Candidate carries its TMDB type, year, genres, rating out of 10 and votes, overview, and:
- status: ADDED or REQUESTED when it was sent to the library from this Share, ALREADY_PRESENT when the library had it, CAN_ADD otherwise.
- libraryState: where the library stood when it was identified (ABSENT, REQUESTED, PARTIAL, AVAILABLE).

A Share's summary: TO_CHOOSE (identified, nothing added yet), ADDED, REQUESTED, ALREADY_PRESENT, NO_MATCH, FAILED, IN_PROGRESS.`;

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
        },
        { shares },
      );
      const answer = {
        shares: page.shares.map(shareForMcp),
        nextCursor: page.nextCursor,
        // The whole history's genres, most Shares first: the names `genres` accepts.
        genres: page.genres,
      };
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
      tmdbRating: candidate.tmdbRating,
      tmdbVotes: candidate.tmdbVotes,
      overview: candidate.overview,
      confidence: candidate.confidence,
      status: candidateStatusOf(candidate, share.additions).status,
      libraryState: candidate.libraryState,
    })),
  };
}
