import { parseInput } from "../input";
import type { ShareQueue } from "../queue";
import type { ShareRepository } from "../repository";
import type { ShareInput } from "../types";

// Records a Share and queues its Identification. Returns at once with its id;
// the Identification runs in the background. Invalid input throws a ZodError.
export async function createShare(
  raw: ShareInput,
  { shares, queue }: { shares: ShareRepository; queue: ShareQueue },
): Promise<string> {
  const { input, source } = parseInput(raw);
  const id = await shares.create(input, source);
  queue.wake();
  return id;
}
