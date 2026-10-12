import { z } from "zod";
import type { ShareInput } from "./types";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Invalid input throws a ZodError, which the RPC layer turns into invalid_argument.
const InputSchema = z
  .object({
    url: z.url({ protocol: /^https?$/ }).optional(),
    text: z.string().trim().min(1).optional(),
    image: z
      .instanceof(Uint8Array)
      .refine((b) => b.length <= MAX_IMAGE_BYTES, "image larger than 4 MB")
      .optional(),
  })
  .refine((i) => i.url || i.text || i.image, "send a url, a text or an image");

export function parseInput(raw: ShareInput): { input: ShareInput; source: string } {
  const input = InputSchema.parse(raw);
  return { input, source: sourceOf(input) };
}

// What the history shows in its Share column.
function sourceOf({ url, image }: ShareInput): string {
  if (url) return new URL(url).hostname.replace(/^www\./, "");
  return image ? "image" : "text";
}
