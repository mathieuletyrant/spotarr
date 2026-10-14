import { MediaType, type Rule as RuleMessage } from "@spotarr/contract";
import type { RuleRepository } from "../../domain/auto-add/repository";
import type { Rule } from "../../domain/auto-add/types";
import { previewRules } from "../../domain/auto-add/use-cases/preview-rules";
import type { ShareRepository } from "../../domain/shares/repository";
import { SpotarrError } from "../../errors";
import type { Rpcs } from "./types";

export function ruleRpcs(
  rules: RuleRepository,
  shares: ShareRepository,
): Rpcs<"listRules" | "saveRule" | "deleteRule" | "previewRules"> {
  return {
    async listRules() {
      return { rules: (await rules.list()).map(toMessage) };
    },

    // A missing name or a value out of range throws a ZodError: invalid_argument.
    async saveRule(req) {
      const { id = "", ...fields } = fromMessage(req.rule);
      if (id && !(await rules.get(id))) throw new SpotarrError("not_found", `no rule ${id}`);
      const saved = await rules.get(await rules.save(id, fields));
      return { rule: saved && toMessage(saved) };
    },

    async deleteRule(req) {
      await rules.delete(req.id);
      return {};
    },

    async previewRules(req) {
      const tried = req.rules.map((r, i) => ({ ...fromMessage(r), id: r.id || `new_${i}` }));
      const preview = await previewRules(tried, shares);
      return {
        shares: preview.shares,
        additions: preview.additions.map(({ candidate, rule, share }) => ({
          shareId: share.id,
          title: candidate.title,
          year: candidate.year,
          type: MediaType[candidate.type],
          posterUrl: candidate.posterUrl,
          rule: rule.name,
        })),
      };
    },
  };
}

function toMessage(rule: Rule) {
  return { ...rule, type: rule.type ? MediaType[rule.type] : MediaType.UNSPECIFIED };
}

// The contract's UNSPECIFIED type means both; an absent number, no condition.
function fromMessage(rule: RuleMessage | undefined): Rule {
  return {
    id: rule?.id ?? "",
    name: rule?.name ?? "",
    enabled: rule?.enabled ?? false,
    type: typeOf(rule?.type),
    onlyOne: rule?.onlyOne ?? false,
    minConfidence: rule?.minConfidence,
    minRating: rule?.minRating,
    minVotes: rule?.minVotes,
    unreleasedSkipsRating: rule?.unreleasedSkipsRating ?? false,
  };
}

function typeOf(type: MediaType | undefined): Rule["type"] {
  if (type === MediaType.MOVIE) return "MOVIE";
  if (type === MediaType.TV) return "TV";
  return undefined;
}
