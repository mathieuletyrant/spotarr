import { z } from "zod";
import { SpotarrError } from "../../../errors";
import { EFFORTS } from "../../../integrations/llm/client";
import type { ShareRepository } from "../../shares/repository";

// Runs the Identification of a finished Share again, with `effort` if given
// (else the setting's). Its Additions are kept. An unknown effort throws a ZodError.
export async function retryIdentification(
  id: string,
  effort: string | undefined,
  shares: ShareRepository,
): Promise<void> {
  const asked = z.enum(EFFORTS).optional().parse(effort);
  const share = await shares.get(id);
  if (!share) throw new SpotarrError("not_found", `no share ${id}`);
  if (share.summary === "IN_PROGRESS") {
    throw new SpotarrError("busy", "identification still in progress");
  }
  // Back to QUEUED: the queue's workers pick it up again.
  await shares.requeue(id, asked);
}
