import { MediaType, RuleAction, Summary, Target } from "@spotarr/contract";
import { retryIdentification } from "../../domain/identification/use-cases/retry-identification";
import type { SettingsRepository } from "../../domain/settings/repository";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Share } from "../../domain/shares/types";
import { addToLibrary } from "../../domain/shares/use-cases/add-to-library";
import { createShare } from "../../domain/shares/use-cases/create-share";
import { deleteShare } from "../../domain/shares/use-cases/delete-share";
import { listHistory } from "../../domain/shares/use-cases/list-history";
import { watchCandidate } from "../../domain/watchlist/use-cases/watch-candidate";
import { SpotarrError } from "../../errors";
import { shareMessage } from "../messages";
import type { Rpcs } from "./types";

// Each RPC translates the contract into a use case of domain/shares, and back.
export function shareRpcs(
  shares: ShareRepository,
  settings: SettingsRepository,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification" | "add" | "deleteShare"> {
  async function shareAnswer(id: string) {
    const share = await shares.get(id);
    if (!share) throw new SpotarrError("not_found", `no share ${id}`);
    return { share: shareMessage(share) };
  }

  return {
    async createShare(req) {
      const id = await createShare(req, shares, settings);
      return shareAnswer(id);
    },

    async getShare(req) {
      return shareAnswer(req.id);
    },

    async listShares(req) {
      const page = await listHistory(
        {
          limit: req.pageSize,
          cursor: req.cursor,
          summaries: req.summaries.map((s) => Summary[s] as Share["summary"]),
          query: req.query?.trim(),
          genres: req.genres,
        },
        { shares },
      );
      return {
        shares: page.shares.map(shareMessage),
        nextCursor: page.nextCursor,
        total: page.total,
        counts: [...page.counts].map(([summary, count]) => ({ summary: Summary[summary], count })),
        genres: page.genres,
      };
    },

    async retryIdentification(req) {
      await retryIdentification(req.id, { effort: req.effort, hint: req.hint }, shares, settings);
      return shareAnswer(req.id);
    },

    async add(req) {
      if (req.action === RuleAction.SEERR_WATCHLIST) {
        await watchCandidate(req.shareId, req.tmdbId, mediaTypeOf(req.type), { shares, settings });
        return shareAnswer(req.shareId);
      }
      await addToLibrary(
        req.shareId,
        {
          tmdbId: req.tmdbId,
          type: mediaTypeOf(req.type),
          target: req.target === Target.ARR ? "ARR" : "SEERR",
        },
        { shares, settings },
      );
      return shareAnswer(req.shareId);
    },

    async deleteShare(req) {
      await deleteShare(req.id, shares);
      return {};
    },
  };
}

// The contract's UNSPECIFIED means the client did not say.
function mediaTypeOf(type: MediaType): "MOVIE" | "TV" | undefined {
  if (type === MediaType.MOVIE) return "MOVIE";
  if (type === MediaType.TV) return "TV";
  return undefined;
}
