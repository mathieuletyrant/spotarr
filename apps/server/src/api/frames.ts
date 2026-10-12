import type { Handler } from "hono";
import type { ShareRepository } from "../domain/shares/repository";

// GET /frames/<share id>/<n>.jpg: one thumbnail of a shared video. Behind the
// API token, like the API; the browser sends the sign-in cookie with <img>.
export function serveFrame(shares: ShareRepository): Handler {
  return async (c) => {
    const position = Number(c.req.param("file")?.replace(/\.jpg$/, ""));
    const shareId = c.req.param("shareId") ?? "";
    const jpeg = Number.isInteger(position)
      ? await shares.frameThumbnail(shareId, position)
      : undefined;
    if (!jpeg) return c.notFound();
    // A retry replaces the thumbnails under the same address: cache briefly.
    // Copied into a plain Uint8Array: Response only takes ArrayBuffer-backed bytes.
    return new Response(new Uint8Array(jpeg), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
    });
  };
}
