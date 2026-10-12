import { expect, test } from "bun:test";
import type { ChatMessage } from "../../integrations/llm/client";
import { type Guesses, guessTitles } from "./guess-titles";

const guesses: Guesses = {
  reasoning: "Zach Galifianakis et Robert Downey Jr. dans le désert : Date limite.",
  candidates: [
    {
      title: "Due Date",
      originalTitle: null,
      year: 2010,
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
    return guesses;
  };

  const answer = await guessTitles(
    { caption: "mood ?", author: "CameraCam" },
    [new Uint8Array([1]), new Uint8Array([2])],
    llm,
  );

  expect(answer).toEqual(guesses);
  const user = sent[1]?.content as { type: string; text?: string }[];
  expect(user[0]?.text).toBe("Caption: mood ?\nAuthor: CameraCam");
  expect(user.filter((part) => part.type === "image_url")).toHaveLength(2);
});
