import { expect, test } from "bun:test";
import type { ChatMessage } from "../../integrations/llm/client";
import { guessTitles } from "./guess-titles";

const valid = {
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

test("sends the caption, the author and every frame, and reads the answer", async () => {
  let sent: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    sent = messages;
    return JSON.stringify(valid);
  };

  const guesses = await guessTitles(
    { caption: "mood ?", author: "CameraCam" },
    [new Uint8Array([1]), new Uint8Array([2])],
    llm,
  );

  expect(guesses.candidates.map((c) => c.title)).toEqual(["Due Date"]);
  const user = sent[1]?.content as { type: string; text?: string }[];
  expect(user[0]?.text).toBe("Caption: mood ?\nAuthor: CameraCam");
  expect(user.filter((part) => part.type === "image_url")).toHaveLength(2);
});

test("an answer wrapped in ```json fences is accepted", async () => {
  const llm = async () => `\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``;
  expect((await guessTitles({}, [], llm)).reasoning).toStartWith("Zach");
});

test("an invalid answer is retried once, with the error sent back", async () => {
  const answers = ["not json at all", JSON.stringify(valid)];
  let lastMessages: ChatMessage[] = [];
  const llm = async (messages: ChatMessage[]) => {
    lastMessages = messages;
    return answers.shift() ?? "";
  };

  expect((await guessTitles({}, [], llm)).candidates).toHaveLength(1);
  expect(lastMessages.at(-1)?.content).toBe(
    "This answer is not valid: not JSON. Answer again, with the JSON only.",
  );
});

test("two invalid answers fail with the validation error", async () => {
  const llm = async () =>
    JSON.stringify({ reasoning: "x", candidates: [{ title: "A", type: "film" }] });
  await expect(guessTitles({}, [], llm)).rejects.toThrow("the LLM answered invalid JSON twice");
});
