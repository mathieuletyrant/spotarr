import type { RuleRepository } from "../../auto-add/repository";
import type { SettingsRepository } from "../../settings/repository";
import type { ShareRepository } from "../../shares/repository";
import { candidatesToAutoAdd } from "../../shares/rules/candidates-to-auto-add";
import { addToLibrary } from "../../shares/use-cases/add-to-library";
import { watchTitle } from "../../watchlist/use-cases/watch-title";

type EndIdentificationDeps = {
  shares: ShareRepository;
  settings: SettingsRepository;
  rules: RuleRepository;
};

// When an Identification ends, auto add requests the Candidates its Rules
// allow, or puts them in Seerr's watchlist when the Rule says so.
export async function endIdentification(
  shareId: string,
  { shares, settings, rules }: EndIdentificationDeps,
): Promise<void> {
  const share = await shares.get(shareId);
  if (!share) return;

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
    await addToLibrary(share.id, request, { shares, settings });
  }
}
