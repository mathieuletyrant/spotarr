import type { ShareRepository } from "../../shares/repository";
import { type AutoAddition, candidatesToAutoAdd } from "../../shares/rules/candidates-to-auto-add";
import type { Share } from "../../shares/types";
import type { Rule } from "../types";

// How many of the latest identified Shares a preview looks at.
const PREVIEW_SHARES = 40;

// What `rules` would have requested over the latest identified Shares, newest
// first, with the library as each Identification found it. Requests nothing.
export async function previewRules(
  rules: Rule[],
  shares: ShareRepository,
): Promise<{ shares: number; additions: (AutoAddition & { share: Share })[] }> {
  const latest = (await shares.all())
    .filter((share) => share.identification.status === "READY")
    .slice(0, PREVIEW_SHARES);
  const additions = latest.flatMap((share) =>
    candidatesToAutoAdd(share.candidates, rules).map((addition) => ({ ...addition, share })),
  );
  return { shares: latest.length, additions };
}
