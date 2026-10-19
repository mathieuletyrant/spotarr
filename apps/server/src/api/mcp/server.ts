// Mounts an MCP server (Model Context Protocol) in Hono, for AI assistants
// like Claude. Stateless: each request gets its own server and transport, so
// nothing is kept between requests.
import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Context } from "hono";
import pkg from "../../../package.json";
import type { ShareRepository } from "../../domain/shares/repository";
import { registerListGenres } from "./list-genres";
import { registerListKeywords } from "./list-keywords";
import { registerListShares } from "./list-shares";

export function mcpHandler(shares: ShareRepository) {
  return async (c: Context) => {
    const server = new McpServer({ name: "spotarr", version: pkg.version });
    registerListShares(server, shares);
    registerListGenres(server, shares);
    registerListKeywords(server, shares);
    // Plain JSON answers rather than an event stream: one tool, quick answers.
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return transport.handleRequest(c);
  };
}
