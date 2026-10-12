import { run } from "../process";

// Resizes a picture to a 768 px JPEG for the LLM, like a video's frames.
export async function resizePicture(picturePath: string): Promise<Uint8Array> {
  const resized = `${picturePath}-768.jpg`;
  await run(
    ["ffmpeg", "-v", "error", "-y", "-i", picturePath].concat([
      "-frames:v",
      "1",
      "-vf",
      "scale=768:-2",
      "-q:v",
      "4",
      resized,
    ]),
    15_000,
  );
  return Bun.file(resized).bytes();
}
