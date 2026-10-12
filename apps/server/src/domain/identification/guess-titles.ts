import { z } from "zod";
import { type ChatMessage, imagePart } from "../../integrations/llm/client";
import type { Clues } from "../shares/types";

// What the LLM must answer. Titles are hypotheses: TMDB confirms them (#17).
const GuessesSchema = z.object({
  reasoning: z.string(),
  candidates: z
    .array(
      z.object({
        title: z.string(),
        originalTitle: z.string().nullish(),
        year: z.int().nullish(),
        type: z.enum(["movie", "tv"]),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
    )
    .max(10),
});
export type Guesses = z.infer<typeof GuessesSchema>;

export type Llm = (messages: ChatMessage[]) => Promise<string>;

const INSTRUCTIONS = `You identify films and TV shows from a short social media video.
You get the caption, the author, and frames taken across the video. On-screen text, posters and actors' faces are often the best clues.

Rules:
- One candidate per work when the video presents several (a "5 films to watch" video gives 5 candidates).
- When a single work is uncertain, give up to 3 hypotheses, the most likely first.
- Prefer the original title and the release year: they are used to search TMDB.
- confidence is between 0 and 1. Never invent a work: an empty list is a valid answer.
- reasoning: two or three sentences, in French, on what gave the answer away.

Answer with this JSON only:
{"reasoning": "…", "candidates": [{"title": "…", "originalTitle": "…" or null, "year": 2019 or null, "type": "movie" or "tv", "confidence": 0.9, "reason": "…"}]}`;

// Asks the LLM which works the video shows. An invalid answer gets one more
// try, with the validation error sent back to the model.
export async function guessTitles(clues: Clues, frames: Uint8Array[], llm: Llm): Promise<Guesses> {
  const messages: ChatMessage[] = [
    { role: "system", content: INSTRUCTIONS },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Caption: ${clues.caption ?? "(none)"}\nAuthor: ${clues.author ?? "(unknown)"}`,
        },
        ...frames.map(imagePart),
      ],
    },
  ];

  const firstAnswer = await llm(messages);
  const first = parseGuesses(firstAnswer);
  if (first.ok) return first.guesses;

  messages.push(
    { role: "assistant", content: firstAnswer },
    {
      role: "user",
      content: `This answer is not valid: ${first.error}. Answer again, with the JSON only.`,
    },
  );
  const second = parseGuesses(await llm(messages));
  if (second.ok) return second.guesses;
  throw new Error(`the LLM answered invalid JSON twice: ${second.error}`);
}

function parseGuesses(
  answer: string,
): { ok: true; guesses: Guesses } | { ok: false; error: string } {
  // Without the JSON option, some models wrap their answer in ```json fences.
  const json = answer.replace(/^\s*```(?:json)?|```\s*$/g, "");
  try {
    const result = GuessesSchema.safeParse(JSON.parse(json));
    return result.success
      ? { ok: true, guesses: result.data }
      : { ok: false, error: z.prettifyError(result.error) };
  } catch {
    return { ok: false, error: "not JSON" };
  }
}
