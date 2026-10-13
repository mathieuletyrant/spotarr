import { parseInput } from "../input";
import type { ShareRepository } from "../repository";
import type { ShareInput } from "../types";

// Records a Share, QUEUED: the queue's workers pick it up within a second.
// Returns at once with its id. Invalid input throws a ZodError.
export async function createShare(raw: ShareInput, shares: ShareRepository): Promise<string> {
  const { input, source } = parseInput(raw);
  return shares.create(input, source);
}
