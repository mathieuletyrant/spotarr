import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { SpotarrError } from "../../errors";

export type LlmConfig = { apiUrl: string; apiKey: string; model: string };
export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

// Sends a conversation to any OpenAI-compatible API (OpenRouter by default) and
// returns the answer parsed with `schema`. The schema goes to the provider as a
// strict JSON schema ("structured outputs"): the model cannot answer anything else.
export async function chat<Schema extends z.ZodType>(
  config: LlmConfig,
  messages: ChatMessage[],
  schema: Schema,
) {
  if (!config.apiKey) {
    throw new SpotarrError(
      "not_configured",
      "LLM API key not configured (Settings → Identification)",
    );
  }
  if (!config.model) {
    throw new SpotarrError(
      "not_configured",
      "LLM model not configured (Settings → Identification)",
    );
  }

  // One automatic retry on a network error, not the SDK's default two.
  const client = new OpenAI({
    baseURL: config.apiUrl,
    apiKey: config.apiKey,
    timeout: 60_000,
    maxRetries: 1,
  });
  const completion = await client.chat.completions
    .parse({
      model: config.model,
      messages,
      response_format: zodResponseFormat(schema, "answer"),
      // Thinking models (Gemini 3.8 Flash) answered in 15 to 45 s without this,
      // in 3 to 6 s with it, naming the same films on the test reel.
      reasoning_effort: "low",
    })
    .catch((error) => {
      throw llmError(error);
    });

  const answer = completion.choices[0]?.message;
  if (answer?.refusal) throw new SpotarrError("unavailable", `the LLM refused: ${answer.refusal}`);
  if (!answer?.parsed) throw new SpotarrError("unavailable", "the LLM gave no answer");
  return answer.parsed;
}

function llmError(error: unknown): SpotarrError {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new SpotarrError("timeout", "the LLM took more than 60 s");
  }
  if (error instanceof OpenAI.APIError && error.status) {
    return new SpotarrError("unavailable", `the LLM answered ${error.status}: ${error.message}`);
  }
  return new SpotarrError("unavailable", `the LLM could not be reached: ${String(error)}`);
}

// A JPEG, the way the OpenAI format carries images inside a message.
export function imagePart(jpeg: Uint8Array): OpenAI.Chat.ChatCompletionContentPartImage {
  return {
    type: "image_url",
    image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}` },
  };
}
