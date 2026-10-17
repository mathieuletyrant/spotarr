import type { RuleRepository } from "../../auto-add/repository";
import type { SettingsRepository } from "../../settings/repository";
import type { Emit, IdentificationEventName } from "../../shares/events";
import type { ShareRepository } from "../../shares/repository";
import { candidatesToAutoAdd } from "../../shares/rules/candidates-to-auto-add";
import type { Share } from "../../shares/types";
import { addToLibrary } from "../../shares/use-cases/add-to-library";
import { watchTitle } from "../../watchlist/use-cases/watch-title";

type EndIdentificationDeps = {
  shares: ShareRepository;
  settings: SettingsRepository;
  rules: RuleRepository;
  emit: Emit;
};

// When an Identification ends, its Event is emitted, then auto add requests
// the Candidates its Rules allow (each one emits media.added), or puts them in
// Seerr's watchlist when the Rule says so.
export async function endIdentification(
  shareId: string,
  { shares, settings, rules, emit }: EndIdentificationDeps,
): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) return;
  await emit({ name: endedEventOf(share), share });

  // Auto add: only a READY Share has Candidates to request.
  if (share.identification.status !== "READY") return;
  const today = new Date().toISOString().slice(0, 10);
  const additions = candidatesToAutoAdd(share.candidates, await rules.list(), today);
  for (const { candidate, rule } of additions) {
    if (rule.action === "SEERR_WATCHLIST") {
      await watchTitle(share.id, candidate, rule.name, settings);
      continue;
    }
    const request = {
      tmdbId: candidate.tmdbId,
      type: candidate.type,
      automatic: true,
      rule: rule.name,
    };
    await addToLibrary(share.id, request, { shares, settings, emit });
  }
}

// Which Event an ended Identification is: READY, NO_MATCH, else FAILED.
function endedEventOf(share: Share): IdentificationEventName {
  if (share.identification.status === "READY") return "identification.ready";
  if (share.identification.status === "NO_MATCH") return "identification.no_match";
  return "identification.failed";
}
