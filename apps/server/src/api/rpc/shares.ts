import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  AdditionStatus,
  IdentificationStatus,
  LibraryState,
  MediaType,
  Method,
  Summary,
  Target,
} from "@spotarr/contract";
import type { ShareQueue } from "../../domain/shares/queue";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Share } from "../../domain/shares/types";
import { addCandidate } from "../../domain/shares/use-cases/add-candidate";
import { createShare } from "../../domain/shares/use-cases/create-share";
import { listHistory } from "../../domain/shares/use-cases/list-history";
import { retryIdentification } from "../../domain/shares/use-cases/retry-identification";
import { SpotarrError } from "../../errors";
import type { Seerr } from "../../integrations/seerr/client";
import type { Rpcs } from "./types";

// Each RPC translates the contract into a use case of domain/shares, and back.
export function shareRpcs(
  shares: ShareRepository,
  queue: ShareQueue,
  seerr: () => Promise<Seerr>,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification" | "add"> {
  async function shareMessage(id: string) {
    const share = await shares.get(id);
    if (!share) throw new SpotarrError("not_found", `no share ${id}`);
    return { share: toMessage(share) };
  }

  return {
    async createShare(req) {
      const id = await createShare(req, { shares, queue });
      return shareMessage(id);
    },

    async getShare(req) {
      return shareMessage(req.id);
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
        shares: page.shares.map(toMessage),
        nextCursor: page.nextCursor,
        total: page.total,
        counts: [...page.counts].map(([summary, count]) => ({ summary: Summary[summary], count })),
      };
    },

    async retryIdentification(req) {
      await retryIdentification(req.id, { shares, queue });
      return shareMessage(req.id);
    },

    async add(req) {
      if (req.target === Target.ARR) {
        throw new SpotarrError(
          "invalid_input",
          "adding to Radarr or Sonarr directly is not supported yet",
        );
      }
      if (req.type === MediaType.UNSPECIFIED)
        throw new SpotarrError("invalid_input", "type is required");
      const type = req.type === MediaType.TV ? "TV" : "MOVIE";
      await addCandidate(
        req.shareId,
        { tmdbId: req.tmdbId, type },
        { shares, seerr: await seerr() },
      );
      return shareMessage(req.shareId);
    },
  };
}

// The domain writes enum values as names ("READY"), the contract as numbers.
// Each enum of the contract maps a name to its number: IdentificationStatus["READY"] is 3.
function toMessage(share: Share) {
  return {
    id: share.id,
    createdAt: timestampFromDate(new Date(share.createdAt)),
    input: share.input,
    source: share.source,
    identification: {
      ...share.identification,
      status: IdentificationStatus[share.identification.status],
      method: Method[share.identification.method ?? "UNSPECIFIED"],
    },
    candidates: share.candidates.map((candidate) => ({
      ...candidate,
      type: MediaType[candidate.type],
      libraryState: LibraryState[candidate.libraryState],
    })),
    additions: share.additions.map((addition) => ({
      ...addition,
      createdAt: timestampFromDate(new Date(addition.createdAt)),
      type: MediaType[addition.type],
      target: Target[addition.target],
      status: AdditionStatus[addition.status],
    })),
    summary: Summary[share.summary],
  };
}
