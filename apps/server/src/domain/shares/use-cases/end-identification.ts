import type { SettingsRepository } from "../../settings/repository";
import type { Emit, IdentificationEventName } from "../events";
import type { ShareRepository } from "../repository";
import { candidatesToAutoAdd } from "../rules/candidates-to-auto-add";
import type { Share } from "../types";
import { addToLibrary } from "./add-to-library";

type EndIdentificationDeps = {
  shares: ShareRepository;
  settings: SettingsRepository;
  emit: Emit;
};

// When an Identification ends, its Event is emitted, then auto add requests
// the Candidates its rule allows (each one emits media.added).
export async function endIdentification(
  shareId: string,
  { shares, settings, emit }: EndIdentificationDeps,
): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) return;
  await emit({ name: endedEventOf(share), share });

  // Auto add: only a READY Share has Candidates to request.
  if (share.identification.status !== "READY") return;
  const { autoAdd } = await settings.get();
  for (const candidate of candidatesToAutoAdd(share.candidates, autoAdd)) {
    const request = { tmdbId: candidate.tmdbId, type: candidate.type, automatic: true };
    await addToLibrary(share.id, request, { shares, settings, emit });
  }
}

// Which Event an ended Identification is: READY, NO_MATCH, else FAILED.
function endedEventOf(share: Share): IdentificationEventName {
  if (share.identification.status === "READY") return "identification.ready";
  if (share.identification.status === "NO_MATCH") return "identification.no_match";
  return "identification.failed";
}
