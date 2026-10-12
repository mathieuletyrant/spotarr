import { afterEach, expect, mock, test } from "bun:test";
import { z } from "zod";
import { fakeFetch } from "../../testing/fake-fetch";
import { chat, ping } from "./client";

afterEach(() => mock.restore());

const config = {
  apiUrl: "https://openrouter.ai/api/v1",
  apiKey: "key",
  model: "google/gemini-3.8-flash",
};
const Answer = z.object({ title: z.string() });

test("returns the answer parsed with the schema", async () => {
  fakeFetch({
    "/api/v1/chat/completions": {
      id: "1",
      object: "chat.completion",
      created: 0,
      model: config.model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: '{"title":"Due Date"}' },
        },
      ],
      // OpenRouter's usage carries the price of the call.
      usage: { prompt_tokens: 1800, completion_tokens: 40, total_tokens: 1840, cost: 0.0012 },
    },
  });
  expect(await chat(config, [], Answer)).toEqual({
    answer: { title: "Due Date" },
    costUsd: 0.0012,
  });
});

test("ping fails like chat when the key is refused", async () => {
  fakeFetch({ "/api/v1/chat/completions": 401 });
  await expect(ping(config)).rejects.toMatchObject({ code: "unavailable" });
});

test("a missing key or model is not_configured", async () => {
  await expect(chat({ ...config, apiKey: "" }, [], Answer)).rejects.toMatchObject({
    code: "not_configured",
  });
  await expect(chat({ ...config, model: "" }, [], Answer)).rejects.toMatchObject({
    code: "not_configured",
  });
});

test("an error status is unavailable, with the status", async () => {
  fakeFetch({ "/api/v1/chat/completions": 401 });
  await expect(chat(config, [], Answer)).rejects.toMatchObject({
    code: "unavailable",
    message: expect.stringContaining("401"),
  });
});
