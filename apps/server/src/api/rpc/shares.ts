import { MediaType, Summary, Target } from "@spotarr/contract";
import type { SettingsRepository } from "../../domain/settings/repository";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Share } from "../../domain/shares/types";
import { addCandidate } from "../../domain/shares/use-cases/add-candidate";
import { createShare } from "../../domain/shares/use-cases/create-share";
import { listHistory } from "../../domain/shares/use-cases/list-history";
import { retryIdentification } from "../../domain/shares/use-cases/retry-identification";
import { SpotarrError } from "../../errors";
import { shareMessage } from "../messages";
import type { WebhookSender } from "../webhooks/sender";
import type { Rpcs } from "./types";

// Each RPC translates the contract into a use case of domain/shares, and back.
export function shareRpcs(
  shares: ShareRepository,
  settings: SettingsRepository,
  sender: WebhookSender,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification" | "add"> {
  async function shareAnswer(id: string) {
    const share = await shares.get(id);
    if (!share) throw new SpotarrError("not_found", `no share ${id}`);
    return { share: shareMessage(share) };
  }

  return {
    async createShare(req) {
      const id = await createShare(req, shares);
      return shareAnswer(id);
    },

    async getShare(req) {
      return shareAnswer(req.id);
    },

    async listShares(req) {
      const page = await listHistory(
        {
          limit: Math.min(req.pageSize ?? 50, 100),
          cursor: req.cursor,
          summaries: req.summaries.map((s) => Summary[s] as Share["summary"]),
          query: req.query?.trim(),
        },
        { shares },
      );
      return {
        shares: page.shares.map(shareMessage),
        nextCursor: page.nextCursor,
        total: page.total,
        counts: [...page.counts].map(([summary, count]) => ({ summary: Summary[summary], count })),
      };
    },

    async retryIdentification(req) {
      await retryIdentification(req.id, shares);
      return shareAnswer(req.id);
    },

    async add(req) {
      await addCandidate(
        req.shareId,
        {
          tmdbId: req.tmdbId,
          type: mediaTypeOf(req.type),
          target: req.target === Target.ARR ? "ARR" : "SEERR",
        },
        { shares, settings, emit: (event) => sender.emit(event) },
      );
      return shareAnswer(req.shareId);
    },
  };
}

// The contract's UNSPECIFIED means the client did not say.
function mediaTypeOf(type: MediaType): "MOVIE" | "TV" | undefined {
  if (type === MediaType.MOVIE) return "MOVIE";
  if (type === MediaType.TV) return "TV";
  return undefined;
}
