import type { SettingsRepository } from "../../settings/repository";
import type { WebhookSender } from "../../webhooks/sender";
import { candidatesToAutoAdd } from "../candidates-to-auto-add";
import type { ShareRepository } from "../repository";
import { addCandidate } from "./add-candidate";

type EndIdentificationDeps = {
  shares: ShareRepository;
  settings: SettingsRepository;
  sender: WebhookSender;
};

// When an Identification ends, the Webhooks hear about it, then auto add
// requests the Candidates its rule allows (each one sends media.added).
export async function endIdentification(
  shareId: string,
  { shares, settings, sender }: EndIdentificationDeps,
): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) return;
  await sender.identificationEnded(share);

  // Auto add: only a READY Share has Candidates to request.
  if (share.identification.status !== "READY") return;
  const { autoAdd } = await settings.get();
  for (const candidate of candidatesToAutoAdd(share.candidates, autoAdd)) {
    const request = { tmdbId: candidate.tmdbId, type: candidate.type, automatic: true };
    await addCandidate(share.id, request, { shares, settings, sender });
  }
}
