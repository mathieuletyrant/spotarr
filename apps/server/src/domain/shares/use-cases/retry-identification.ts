import { SpotarrError } from "../../../errors";
import type { ShareQueue } from "../queue";
import type { ShareRepository } from "../repository";

// Runs the Identification of a finished Share again. Its Additions are kept.
export async function retryIdentification(
  id: string,
  { shares, queue }: { shares: ShareRepository; queue: ShareQueue },
): Promise<void> {
  const share = await shares.get(id);
  if (!share) throw new SpotarrError("not_found", `no share ${id}`);
  if (share.summary === "IN_PROGRESS") {
    throw new SpotarrError("busy", "identification still in progress");
  }
  await shares.requeue(id);
  queue.wake();
}
