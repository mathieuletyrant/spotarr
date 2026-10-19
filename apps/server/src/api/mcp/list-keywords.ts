import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ShareRepository } from "../../domain/shares/repository";
import { listKeywords } from "../../domain/shares/use-cases/list-keywords";

const ListKeywordsInput = {
  contains: z
    .string()
    .optional()
    .describe(
      'Only the keywords containing these letters, case-insensitive: "novel" gives "based on novel or book". All when absent; there can be hundreds.',
    ),
};

const DESCRIPTION = `Lists the keywords of the movies and TV shows the user shared to Spotarr, with how many Shares have each, most first. Read-only.

Keywords are the tags TMDB's users give a title, more precise than genres: "detective", "based on novel or book", "psychological drama", "time travel". TMDB has them in English only. Call this before filtering list_shares by keyword, and pass the names exactly as they come.`;

export function registerListKeywords(server: McpServer, shares: ShareRepository): void {
  server.registerTool(
    "list_keywords",
    {
      title: "List the keywords of Spotarr's Shares",
      description: DESCRIPTION,
      inputSchema: ListKeywordsInput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => {
      let keywords = await listKeywords({ shares });
      const contains = input.contains?.trim().toLowerCase();
      if (contains) keywords = keywords.filter((k) => k.keyword.toLowerCase().includes(contains));
      return { content: [{ type: "text", text: JSON.stringify({ keywords }) }] };
    },
  );
}
