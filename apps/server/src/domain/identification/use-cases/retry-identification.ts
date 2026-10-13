import { z } from "zod";
import { SpotarrError } from "../../../errors";
import { EFFORTS } from "../../../integrations/llm/client";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../../shares/repository";

// What a Retry may ask: an effort, and a hint of one sentence or so. An empty
// hint is no hint.
const RetrySchema = z.object({
  effort: z.enum(EFFORTS).optional(),
  hint: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((hint) => hint || undefined),
});

// Runs the Identification of a finished Share again, with an effort (else the
// setting's, kept with it so the pages can say how long it may take) and a hint
// if given. Its Additions are kept. An unknown effort or a hint too long throws
// a ZodError.
export async function retryIdentification(
  id: string,
  retry: { effort?: string; hint?: string },
  shares: ShareRepository,
  settings: SettingsRepository,
): Promise<void> {
  const asked = RetrySchema.parse(retry);
  const share = await shares.get(id);
  if (!share) throw new SpotarrError("not_found", `no share ${id}`);
  if (share.summary === "IN_PROGRESS") {
    throw new SpotarrError("busy", "identification still in progress");
  }
  const effort = asked.effort ?? (await settings.get()).identification.effort;
  // Back to QUEUED: the queue's workers pick it up again.
  await shares.requeue(id, { effort, hint: asked.hint });
}
