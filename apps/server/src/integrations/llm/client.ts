import OpenAI from "openai";

export type LlmConfig = { apiUrl: string; apiKey: string; model: string; forceJson: boolean };
export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

// Sends a conversation to any OpenAI-compatible API (OpenRouter by default)
// and returns the model's answer as text.
export async function chat(config: LlmConfig, messages: ChatMessage[]): Promise<string> {
  if (!config.apiKey) throw new Error("LLM API key not configured (Settings → Identification)");
  if (!config.model) throw new Error("LLM model not configured (Settings → Identification)");

  // One automatic retry on a network error, not the SDK's default two.
  const client = new OpenAI({
    baseURL: config.apiUrl,
    apiKey: config.apiKey,
    timeout: 60_000,
    maxRetries: 1,
  });
  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    // Thinking models (Gemini 3.8 Flash) answered in 15 to 45 s without this,
    // in 3 to 6 s with it, naming the same films on the test reel.
    reasoning_effort: "low",
    // Asks for JSON only; some models refuse the option, hence the setting.
    ...(config.forceJson ? { response_format: { type: "json_object" } } : {}),
  });
  return completion.choices[0]?.message.content ?? "";
}

// A JPEG, the way the OpenAI format carries images inside a message.
export function imagePart(jpeg: Uint8Array): OpenAI.Chat.ChatCompletionContentPartImage {
  return {
    type: "image_url",
    image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}` },
  };
}
