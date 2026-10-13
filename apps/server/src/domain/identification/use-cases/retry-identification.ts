import { SpotarrError } from "../../../errors";
import type { ShareRepository } from "../../shares/repository";

// Runs the Identification of a finished Share again. Its Additions are kept.
export async function retryIdentification(id: string, shares: ShareRepository): Promise<void> {
  const share = await shares.get(id);
  if (!share) throw new SpotarrError("not_found", `no share ${id}`);
  if (share.summary === "IN_PROGRESS") {
    throw new SpotarrError("busy", "identification still in progress");
  }
  // Back to QUEUED: the queue's workers pick it up again.
  await shares.requeue(id);
}
