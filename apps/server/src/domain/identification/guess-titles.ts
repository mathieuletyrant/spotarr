import { z } from "zod";
import { audioPart, type ChatMessage, imagePart } from "../../integrations/llm/client";
import type { Clues } from "../shares/types";

// The answer the LLM must give, sent to it as a strict JSON schema.
// Titles are guesses: TMDB confirms them.
const GuessSchema = z.object({
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.int().nullable().describe("Release year"),
  originalLanguage: z
    .string()
    .nullable()
    .describe("ISO 639-1 code of the work's original language, e.g. fr, en, ko"),
  type: z.enum(["movie", "tv"]),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});
export type Guess = z.infer<typeof GuessSchema>;

export const AnswerSchema = z.object({
  reasoning: z
    .string()
    .describe("Two or three sentences, in French, on what gave the answer away."),
  guesses: z.array(GuessSchema).max(10),
});
export type Answer = z.infer<typeof AnswerSchema>;

// The LLM's answer, and what it cost when its provider says.
export type LlmReply = { answer: Answer; costUsd?: number };
export type Llm = (messages: ChatMessage[]) => Promise<LlmReply>;

const INSTRUCTIONS = `You identify films and TV shows from a short social media video.
You get the caption, the author, frames taken across the video, and usually its sound. The person speaking often says the title out loud: listen for it. On-screen text, posters and actors' faces are good clues too.

Rules:
- One candidate per work when the video presents several (a "5 films to watch" video gives 5 candidates).
- When a single work is uncertain, give up to 3 guesses, the most likely first.
- Prefer the original title and the release year: they are used to search TMDB.
- Never invent a work: an empty list is a valid answer.`;

// What the LLM gets: a video's frames and sound, or a photo post's picture alone.
type LlmInput = { clues: Clues; images: Uint8Array[]; audio?: Uint8Array };

// Asks the LLM which works the video shows, from what it reads, sees and hears.
// `today` matters: without it the LLM dates a film released this year to the
// years it knows, and TMDB then finds a namesake ("Kraken" 2024 → "Kraken Mare").
export async function guessTitles(
  { clues, images, audio }: LlmInput,
  llm: Llm,
  today = new Date(),
): Promise<LlmReply> {
  return llm([
    {
      role: "system",
      content: `${INSTRUCTIONS}\n\nToday is ${today.toISOString().slice(0, 10)}. Recent releases exist that you may know little about: trust what the video says and shows.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Caption: ${clues.caption ?? "(none)"}\nAuthor: ${clues.author ?? "(unknown)"}`,
        },
        ...images.map(imagePart),
        ...(audio ? [audioPart(audio)] : []),
      ],
    },
  ]);
}
