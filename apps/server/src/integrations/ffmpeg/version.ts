import { run } from "../process";

// "9.0.2", from the first line: "ffmpeg version 9.0.2 Copyright (c) …".
export async function ffmpegVersion(): Promise<string> {
  const printed = await run(["ffmpeg", "-version"], 10_000);
  return printed.split(" ")[2] ?? "unknown";
}
