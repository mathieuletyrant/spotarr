import { SpotarrError } from "../../../errors";
import type { Seerr } from "../../../integrations/seerr/client";
import { log } from "../../../log";
import type { ShareRepository } from "../repository";
import type { Candidate, Share } from "../types";

export type AddCandidateDeps = {
  shares: ShareRepository;
  seerr: Seerr;
  // Told once Seerr accepted the request (the media.added Event).
  mediaAdded?: (share: Share, added: Candidate) => Promise<void>;
  // True when auto add asks, not a click.
  automatic?: boolean;
};

// Adds one Candidate of a Share to the library through Seerr, and records an
// Addition saying what happened. Seerr failing is recorded too (FAILED, with
// the reason), so the history shows it.
export async function addCandidate(
  shareId: string,
  candidate: Pick<Candidate, "tmdbId" | "type">,
  { shares, seerr, mediaAdded, automatic = false }: AddCandidateDeps,
): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) throw new SpotarrError("not_found", `no share ${shareId}`);
  const known = share.candidates.find(
    (c) => c.tmdbId === candidate.tmdbId && c.type === candidate.type,
  );
  if (!known)
    throw new SpotarrError("not_found", `no candidate ${candidate.tmdbId} in share ${shareId}`);

  const addition = {
    tmdbId: candidate.tmdbId,
    type: candidate.type,
    target: "SEERR" as const,
    automatic,
  };
  try {
    // Checked again now: the library may have changed since the Identification.
    const state = await seerr.libraryState(candidate.type, candidate.tmdbId);
    if (state !== "ABSENT") {
      await shares.addAddition(shareId, { ...addition, status: "ALREADY_PRESENT" });
      return;
    }
    await seerr.request(candidate.type, candidate.tmdbId);
    await shares.addAddition(shareId, { ...addition, status: "REQUESTED" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await shares.addAddition(shareId, { ...addition, status: "FAILED", error: reason });
    return;
  }
  // The Addition is recorded: a Webhook failing must not fail it.
  if (mediaAdded) {
    await mediaAdded(share, known).catch((error) =>
      log({ shareId, step: "media-added", error: String(error) }),
    );
  }
}
