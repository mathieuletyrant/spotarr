import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SpotarrError } from "../../errors";

// How long a thinking model thinks before answering: slower and dearer as it goes up.
export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

// How long the LLM may think at each effort before Spotarr gives up. Gemini 3.8
// Flash answers in 3 to 6 s at low; at medium it once went past 60 s (2026-10-13).
// The web UI and the iOS app show these next to each effort: keep them in step.
const TIMEOUT_SECONDS: Record<Effort, number> = { low: 60, medium: 180, high: 300 };

export type LlmConfig = { apiUrl: string; apiKey: string; model: string; effort: Effort };
export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

// Sends a conversation to any OpenAI-compatible API (OpenRouter by default) and
// returns the answer parsed with `schema`, and its cost when the provider says.
// The schema goes to the provider as a strict JSON schema ("structured
// outputs"): the model cannot answer anything else.
export async function chat<Schema extends z.ZodType>(
  config: LlmConfig,
  messages: ChatMessage[],
  schema: Schema,
) {
  const completion = await newClient(config)
    .chat.completions.parse({
      model: config.model,
      messages,
      response_format: zodResponseFormat(schema, "answer"),
      reasoning_effort: config.effort,
    })
    .catch((error) => {
      throw llmError(error, config.effort);
    });

  const answer = completion.choices[0]?.message;
  if (answer?.refusal) throw new SpotarrError("unavailable", `the LLM refused: ${answer.refusal}`);
  if (!answer?.parsed) throw new SpotarrError("unavailable", "the LLM gave no answer");
  return { answer: answer.parsed, costUsd: costOf(completion.usage) };
}

// The smallest call that proves the key and the model work: a one-word answer,
// about $0.00001.
export async function ping(config: LlmConfig): Promise<void> {
  await newClient(config)
    .chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: "Answer ok." }],
      max_completion_tokens: 16,
    })
    .catch((error) => {
      throw llmError(error, config.effort);
    });
}

// OpenRouter adds the price of each call to `usage`; other providers may not.
function costOf(usage: unknown): number | undefined {
  const withCost = z.object({ cost: z.number() }).safeParse(usage);
  if (!withCost.success) return undefined;
  return withCost.data.cost;
}

function newClient(config: LlmConfig): OpenAI {
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

  // The SDK also retries after a timeout: at low, one retry still ends within
  // 2 minutes; at medium or high, it would only double a long wait.
  let maxRetries = 0;
  if (config.effort === "low") maxRetries = 1;
  return new OpenAI({
    baseURL: config.apiUrl,
    apiKey: config.apiKey,
    timeout: TIMEOUT_SECONDS[config.effort] * 1000,
    maxRetries,
  });
}

function llmError(error: unknown, effort: Effort): SpotarrError {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new SpotarrError(
      "timeout",
      `the LLM took more than ${TIMEOUT_SECONDS[effort]} s at ${effort} effort`,
    );
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

// An MP3, the way the OpenAI format carries sound inside a message. Models
// that listen (Gemini) hear it; the setting's model must accept audio.
export function audioPart(mp3: Uint8Array): OpenAI.Chat.ChatCompletionContentPartInputAudio {
  return {
    type: "input_audio",
    input_audio: { data: Buffer.from(mp3).toString("base64"), format: "mp3" },
  };
}
