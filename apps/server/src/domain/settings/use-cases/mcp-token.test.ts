import { expect, test } from "bun:test";
import { openDatabase } from "../../../db";
import { SettingsRepository } from "../repository";
import { ensureMcpToken } from "./ensure-mcp-token";
import { regenerateMcpToken } from "./regenerate-mcp-token";

test("the MCP token is created once, apart from the API token", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));

  await ensureMcpToken(settings);
  const first = (await settings.get()).access.mcpToken;
  await ensureMcpToken(settings);

  expect(first).toMatch(/^[\w-]{43}$/);
  expect((await settings.get()).access).toMatchObject({ mcpToken: first, apiToken: "" });
});

test("regenerating gives a new MCP token, saved", async () => {
  const settings = new SettingsRepository(await openDatabase(":memory:"));
  await ensureMcpToken(settings);
  const old = (await settings.get()).access.mcpToken;

  const fresh = await regenerateMcpToken(settings);

  expect(fresh).not.toBe(old);
  expect((await settings.get()).access.mcpToken).toBe(fresh);
});
