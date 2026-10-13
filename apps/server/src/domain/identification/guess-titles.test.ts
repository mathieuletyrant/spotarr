import { expect, test } from "bun:test";
import type { ChatMessage } from "../../integrations/llm/client";
import { type Answer, guessTitles } from "./guess-titles";

const answer: Answer = {
  reasoning: "Zach Galifianakis et Robert Downey Jr. dans le désert : Date limite.",
  guesses: [
    {
      title: "Due Date",
      originalTitle: null,
      year: 2010,
      originalLanguage: "en",
      type: "movie",
      confidence: 0.9,
      reason: "acteurs",
    },
  ],
};

test("sends the caption, the author and every frame, and returns the LLM's answer", async () => {
  let sent: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    sent = messages;
    return { answer };
  };

  const result = await guessTitles(
    {
      clues: { caption: "mood ?", author: "CameraCam" },
      images: [new Uint8Array([1]), new Uint8Array([2])],
    },
    llm,
  );

  expect(result).toEqual({ answer });
  const user = sent[1]?.content as { type: string; text?: string }[];
  expect(user[0]?.text).toBe("Caption: mood ?\nAuthor: CameraCam");
  expect(user.filter((part) => part.type === "image_url")).toHaveLength(2);
});

test("the video's sound goes with the frames, as MP3", async () => {
  let sent: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    sent = messages;
    return { answer };
  };

  await guessTitles(
    { clues: {}, images: [new Uint8Array([1])], audio: new Uint8Array([7, 7]) },
    llm,
  );

  const parts = sent[1]?.content as {
    type: string;
    input_audio?: { data: string; format: string };
  }[];
  const audio = parts.find((part) => part.type === "input_audio");
  expect(audio?.input_audio).toEqual({
    data: Buffer.from([7, 7]).toString("base64"),
    format: "mp3",
  });
});

test("the LLM is told today's date, so this year's films are not dated to past years", async () => {
  let sent: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    sent = messages;
    return { answer };
  };
  await guessTitles({ clues: {}, images: [] }, llm, new Date("2026-10-12T10:00:00Z"));
  expect(String(sent[0]?.content)).toContain("Today is 2026-10-12.");
});

test("a Retry's hint goes after the caption and the author", async () => {
  let sent: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    sent = messages;
    return { answer };
  };
  await guessTitles(
    { clues: { caption: "mood ?" }, hint: "the Korean show, not the movie", images: [] },
    llm,
  );
  const user = sent[1]?.content as { type: string; text?: string }[];
  expect(user[0]?.text).toBe(
    "Caption: mood ?\nAuthor: (unknown)\nHint from the person who shared it: the Korean show, not the movie",
  );
});
