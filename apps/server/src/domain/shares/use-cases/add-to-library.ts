import { SpotarrError } from "../../../errors";
import { seerrFrom } from "../../settings/adapters";
import type { SettingsRepository } from "../../settings/repository";
import { addToSnug } from "../../snug/use-cases/add-to-snug";
import type { ShareRepository } from "../repository";
import type { Candidate } from "../types";

type AddToLibraryDeps = {
  shares: ShareRepository;
  settings: SettingsRepository;
};

// What a click on Add, or auto add, asks for.
export type AdditionRequest = {
  tmdbId: number;
  // Absent when the client did not say: refused.
  type?: Candidate["type"];
  // Seerr unless the client asked for Radarr or Sonarr directly: refused for now.
  target?: "SEERR" | "ARR";
  // True when auto add asks, not a click; `rule` names the Rule that holds.
  automatic?: boolean;
  rule?: string;
};

// Adds one Candidate of a Share to the library through Seerr, records an
// Addition saying what happened. A TV show also goes on Snug's Watchlist.
// Seerr failing is recorded too (FAILED, with the reason), so the history shows it.
export async function addToLibrary(
  shareId: string,
  request: AdditionRequest,
  { shares, settings }: AddToLibraryDeps,
): Promise<void> {
  if (request.target === "ARR") {
    throw new SpotarrError(
      "invalid_input",
      "adding to Radarr or Sonarr directly is not supported yet",
    );
  }
  const type = request.type;
  if (!type) throw new SpotarrError("invalid_input", "type is required");

  const share = await shares.get(shareId);
  if (!share) throw new SpotarrError("not_found", `no share ${shareId}`);
  const known = share.candidates.find((c) => c.tmdbId === request.tmdbId && c.type === type);
  if (!known) {
    throw new SpotarrError("not_found", `no candidate ${request.tmdbId} in share ${shareId}`);
  }

  const addition = {
    tmdbId: request.tmdbId,
    type,
    target: "SEERR" as const,
    automatic: request.automatic ?? false,
    rule: request.rule,
  };
  try {
    const seerr = seerrFrom(await settings.get());
    // Checked again now: the library may have changed since the Identification.
    const state = await seerr.libraryState(type, request.tmdbId);
    if (state !== "ABSENT") {
      await shares.addAddition(shareId, { ...addition, status: "ALREADY_PRESENT" });
      await shares.setLibraryState(type, request.tmdbId, state);
      await addToSnug(shareId, addition, settings);
      return;
    }
    await seerr.request(type, request.tmdbId);
    await shares.addAddition(shareId, { ...addition, status: "REQUESTED" });
    // Shown at once, without waiting for Seerr to report the request.
    await shares.setLibraryState(type, request.tmdbId, "REQUESTED");
    await addToSnug(shareId, addition, settings);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await shares.addAddition(shareId, { ...addition, status: "FAILED", error: reason });
  }
}
