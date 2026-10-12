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
import { addCandidate } from "../../domain/shares/add";
import { historyPage } from "../../domain/shares/history";
import { parseInput } from "../../domain/shares/input";
import type { ShareQueue } from "../../domain/shares/queue";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Share } from "../../domain/shares/types";
import { SpotarrError } from "../../errors";
import type { Seerr } from "../../integrations/seerr/client";
import type { Rpcs } from "./types";

export function shareRpcs(
  shares: ShareRepository,
  queue: ShareQueue,
  seerr: () => Promise<Seerr>,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification" | "add"> {
  async function getOrFail(id: string): Promise<Share> {
    const share = await shares.get(id);
    if (!share) throw new SpotarrError("not_found", `no share ${id}`);
    return share;
  }

  return {
    // Invalid input throws a ZodError: rpc/errors.ts answers invalid_argument.
    async createShare(req) {
      const { input, source } = parseInput(req);
      const id = await shares.create(input, source);
      queue.wake();
      return { share: toMessage(await getOrFail(id)) };
    },

    async getShare(req) {
      return { share: toMessage(await getOrFail(req.id)) };
    },

    async listShares(req) {
      const page = historyPage(await shares.all(), {
        limit: Math.min(req.pageSize ?? 50, 100),
        cursor: req.cursor,
        summaries: req.summaries.map((s) => Summary[s] as Share["summary"]),
        query: req.query?.trim(),
      });
      return { shares: page.shares.map(toMessage), nextCursor: page.nextCursor };
    },

    async retryIdentification(req) {
      const share = await getOrFail(req.id);
      if (share.summary === "IN_PROGRESS") {
        throw new SpotarrError("busy", "identification still in progress");
      }
      await shares.requeue(req.id);
      queue.wake();
      return { share: toMessage(await getOrFail(req.id)) };
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
      return { share: toMessage(await getOrFail(req.shareId)) };
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
