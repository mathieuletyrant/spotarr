import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShareRepository } from "../../domain/shares/repository";
import { listGenres } from "../../domain/shares/use-cases/list-genres";

const DESCRIPTION = `Lists the genres of the movies and TV shows the user shared to Spotarr, with how many Shares have each, most first. Read-only, no parameters.

They are TMDB's names in Spotarr's language ("Comédie", "Science-Fiction"): call this before filtering list_shares by genre, and pass the names exactly as they come.`;

export function registerListGenres(server: McpServer, shares: ShareRepository): void {
  server.registerTool(
    "list_genres",
    {
      title: "List the genres of Spotarr's Shares",
      description: DESCRIPTION,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const genres = await listGenres({ shares });
      return { content: [{ type: "text", text: JSON.stringify({ genres }) }] };
    },
  );
}
