import { z } from "zod";
import { type ChatMessage, imagePart } from "../../integrations/llm/client";
import type { Clues } from "../shares/types";

// The answer the LLM must give, sent to it as a strict JSON schema.
// Titles are hypotheses: TMDB confirms them (#17).
export const GuessesSchema = z.object({
  reasoning: z
    .string()
    .describe("Two or three sentences, in French, on what gave the answer away."),
  candidates: z
    .array(
      z.object({
        title: z.string(),
        originalTitle: z.string().nullable(),
        year: z.int().nullable().describe("Release year"),
        type: z.enum(["movie", "tv"]),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
    )
    .max(10),
});
export type Guesses = z.infer<typeof GuessesSchema>;

export type Llm = (messages: ChatMessage[]) => Promise<Guesses>;

const INSTRUCTIONS = `You identify films and TV shows from a short social media video.
You get the caption, the author, and frames taken across the video. On-screen text, posters and actors' faces are often the best clues.

Rules:
- One candidate per work when the video presents several (a "5 films to watch" video gives 5 candidates).
- When a single work is uncertain, give up to 3 hypotheses, the most likely first.
- Prefer the original title and the release year: they are used to search TMDB.
- Never invent a work: an empty list is a valid answer.`;

// Asks the LLM which works the video shows.
export async function guessTitles(clues: Clues, frames: Uint8Array[], llm: Llm): Promise<Guesses> {
  return llm([
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
  ]);
}
