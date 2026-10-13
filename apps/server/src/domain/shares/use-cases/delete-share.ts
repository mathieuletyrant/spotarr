import { SpotarrError } from "../../../errors";
import type { ShareRepository } from "../repository";

// Deletes a Share from Spotarr. What was requested in Seerr stays there.
// A running Identification would end on a Share that no longer exists, so it is
// refused until then. A QUEUED Share can go: the queue claims a Share in one
// statement, so it never picks a deleted one.
export async function deleteShare(id: string, shares: ShareRepository): Promise<void> {
  const share = await shares.get(id);
  if (!share) throw new SpotarrError("not_found", `no share ${id}`);
  const deleted = await shares.delete(id);
  if (!deleted) {
    throw new SpotarrError("busy", "identification in progress: wait for it to end");
  }
}
