import { expect, test } from "bun:test";
import { run } from "./process";

test("returns what the program printed", async () => {
  expect(await run(["echo", "hello"], 5_000)).toBe("hello\n");
});

test("a failing program throws its last error line", async () => {
  await expect(run(["ls", "/no/such/folder"], 5_000)).rejects.toMatchObject({
    code: "unavailable",
  });
});

test("a program that takes too long is stopped", async () => {
  await expect(run(["sleep", "5"], 200)).rejects.toMatchObject({
    code: "timeout",
    message: "sleep took more than 0.2 s",
  });
});
