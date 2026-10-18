import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../../app";
import { openDatabase } from "../../db";
import { RuleRepository } from "../../domain/auto-add/repository";
import { SettingsRepository } from "../../domain/settings/repository";
import { ShareRepository } from "../../domain/shares/repository";
import type { Candidate } from "../../domain/shares/types";

const db = await openDatabase(":memory:");
const settings = new SettingsRepository(db);
await settings.setApiToken("api-token");
await settings.setMcpToken("mcp-token");
const shares = new ShareRepository(db);
const app = createApp({
  rules: new RuleRepository(db),
  apiToken: () => "api-token",
  settings,
  shares,
});

// One reel, two guesses: the comedy was added, the drama was not.
const dueDate: Candidate = {
  tmdbId: 41733,
  type: "MOVIE",
  title: "Date limite",
  year: 2010,
  genres: ["Comédie"],
  tmdbRating: 6.4,
  tmdbVotes: 5321,
  overview: "Un futur papa traverse le pays avec un inconnu.",
  confidence: 0.9,
  libraryState: "ABSENT",
};
const whiplash: Candidate = {
  tmdbId: 244786,
  type: "MOVIE",
  title: "Whiplash",
  genres: ["Drame"],
  confidence: 0.4,
  libraryState: "ABSENT",
};
const reel = await shares.create({ url: "https://www.instagram.com/reel/abc/" }, "instagram.com");
await shares.finish(
  reel,
  { status: "READY", extractors: [], clues: {}, candidates: [dueDate, whiplash] },
  5,
);
await shares.addAddition(reel, {
  tmdbId: 41733,
  type: "MOVIE",
  target: "SEERR",
  status: "REQUESTED",
  automatic: false,
});
await shares.setLibraryState("MOVIE", 41733, "REQUESTED");
const other = await shares.create({ text: "Severance" }, "text");
await shares.finish(
  other,
  {
    status: "READY",
    extractors: [],
    clues: {},
    candidates: [
      { tmdbId: 95396, type: "TV", title: "Severance", genres: ["Drame"], libraryState: "ABSENT" },
    ],
  },
  5,
);

// A real MCP client, its HTTP calls answered by the app without a network.
async function connect(token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://spotarr.test/mcp?token=${token}`),
    { fetch: async (url, init) => app.request(String(url), init) },
  );
  const client = new Client({ name: "test", version: "1" });
  await client.connect(transport);
  return client;
}

async function listShares(client: Client, args: Record<string, unknown>) {
  const result = await client.callTool({ name: "list_shares", arguments: args });
  const [content] = result.content as { type: string; text: string }[];
  return JSON.parse(content?.text ?? "");
}

test("with the MCP token, a client finds list_shares and list_genres, read-only", async () => {
  const client = await connect("mcp-token");
  const { tools } = await client.listTools();
  expect(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint])).toEqual([
    ["list_shares", true],
    ["list_genres", true],
  ]);
  await client.close();
});

test("list_shares filters by genre and marks the added Candidate", async () => {
  const client = await connect("mcp-token");
  const answer = await listShares(client, { genres: ["Comédie"] });

  expect(answer.shares).toHaveLength(1);
  expect(answer.shares[0]).toMatchObject({
    id: reel,
    source: "instagram.com",
    url: "https://www.instagram.com/reel/abc/",
    summary: "REQUESTED",
  });
  expect(answer.shares[0].candidates).toEqual([
    {
      tmdbId: 41733,
      type: "MOVIE",
      title: "Date limite",
      year: 2010,
      genres: ["Comédie"],
      tmdbRating: 6.4,
      tmdbVotes: 5321,
      overview: "Un futur papa traverse le pays avec un inconnu.",
      confidence: 0.9,
      status: "REQUESTED",
      libraryState: "REQUESTED",
    },
    {
      tmdbId: 244786,
      type: "MOVIE",
      title: "Whiplash",
      genres: ["Drame"],
      confidence: 0.4,
      status: "CAN_ADD",
      libraryState: "ABSENT",
    },
  ]);
  await client.close();
});

test("list_genres gives every genre of the history, most Shares first", async () => {
  const client = await connect("mcp-token");
  const result = await client.callTool({ name: "list_genres", arguments: {} });
  const [content] = result.content as { type: string; text: string }[];

  expect(JSON.parse(content?.text ?? "")).toEqual({
    genres: [
      { genre: "Drame", count: 2 },
      { genre: "Comédie", count: 1 },
    ],
  });
  await client.close();
});

test("list_shares pages with the cursor, newest first", async () => {
  const client = await connect("mcp-token");
  const first = await listShares(client, { pageSize: 1 });
  const second = await listShares(client, { pageSize: 1, cursor: first.nextCursor });

  expect(first.shares.map((s: { id: string }) => s.id)).toEqual([other]);
  expect(second.shares.map((s: { id: string }) => s.id)).toEqual([reel]);
  expect(second.nextCursor).toBeUndefined();
  await client.close();
});

const initialize = (url: string) =>
  app.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "1" },
      },
    }),
  });

test("/mcp without a token, with a wrong one or with the API token is refused", async () => {
  for (const url of ["/mcp", "/mcp?token=nope", "/mcp?token=api-token"]) {
    const res = await initialize(url);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      code: "unauthenticated",
      message: "missing or invalid MCP token",
    });
  }
  expect((await initialize("/mcp?token=mcp-token")).status).toBe(200);
});

test("the API refuses the MCP token", async () => {
  const res = await app.request("/api/spotarr.v1.SpotarrService/ListShares", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer mcp-token" },
    body: "{}",
  });
  expect(res.status).toBe(401);
});

test("RegenerateMcpToken shows the new token in the settings; the old one is refused", async () => {
  const res = await app.request("/api/spotarr.v1.SpotarrService/RegenerateMcpToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer api-token" },
    body: "{}",
  });
  const { mcpToken } = await res.json();

  expect(mcpToken).toMatch(/^[\w-]{43}$/);
  expect((await settings.get()).access.mcpToken).toBe(mcpToken);
  expect((await initialize("/mcp?token=mcp-token")).status).toBe(401);
  expect((await initialize(`/mcp?token=${mcpToken}`)).status).toBe(200);
});

test("/mcp keeps no session: GET and DELETE are 405", async () => {
  const { mcpToken } = (await settings.get()).access;
  for (const method of ["GET", "DELETE"]) {
    const res = await app.request(`/mcp?token=${mcpToken}`, { method });
    expect(res.status).toBe(405);
  }
});

test("every input of list_shares is described, each Summary included", async () => {
  const client = await connect((await settings.get()).access.mcpToken);
  const { tools } = await client.listTools();
  const listShares = tools.find((tool) => tool.name === "list_shares");
  const properties = listShares?.inputSchema.properties as Record<string, { description?: string }>;

  expect(Object.keys(properties).sort()).toEqual([
    "cursor",
    "genres",
    "pageSize",
    "query",
    "summaries",
  ]);
  for (const property of Object.values(properties)) expect(property.description).toBeTruthy();
  for (const summary of ["TO_CHOOSE", "REQUESTED", "ALREADY_PRESENT", "NO_MATCH", "FAILED"]) {
    expect(properties.summaries?.description).toContain(`- ${summary}:`);
  }
  await client.close();
});
