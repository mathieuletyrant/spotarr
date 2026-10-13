import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import type { WebhookSender } from "../../webhooks/sender";
import type { ShareRepository } from "../repository";
import { autoAdd } from "./auto-add";

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
  const current = await settings.get();
  await sender.identificationEnded(share);
  await autoAdd(share, current.autoAdd, {
    shares,
    seerr: seerrFrom(current),
    mediaAdded: (share, added) => sender.mediaAdded(share, added),
  });
}
