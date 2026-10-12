import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resizePicture } from "../../../integrations/ffmpeg/picture";
import { downloadPicture, readInstagramPost } from "../../../integrations/instagram/post";

export type Photo = { caption?: string; author?: string; picture: Uint8Array };

// Reads a shared Instagram photo post: its caption, its author and its first
// picture, a 768 px JPEG for the LLM. The picture is not kept.
export async function readPhoto(url: string): Promise<Photo> {
  const post = await readInstagramPost(url);
  const dir = await mkdtemp(join(tmpdir(), "spotarr-"));
  try {
    const file = join(dir, "picture.jpg");
    await Bun.write(file, await downloadPicture(post.imageUrl));
    return { caption: post.caption, author: post.author, picture: await resizePicture(file) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
