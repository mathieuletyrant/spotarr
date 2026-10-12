import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import {
  AdditionStatus,
  IdentificationStatus,
  LibraryState,
  MediaType,
  Method,
  Summary,
  Target,
} from "@spotarr/contract";
import { historyPage } from "../../domain/shares/history";
import { parseInput } from "../../domain/shares/input";
import type { ShareQueue } from "../../domain/shares/queue";
import type { ShareRepository } from "../../domain/shares/repository";
import type { Share } from "../../domain/shares/types";
import type { Rpcs } from "./types";

export function shareRpcs(
  shares: ShareRepository,
  queue: ShareQueue,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification"> {
  async function getOrFail(id: string): Promise<Share> {
    const share = await shares.get(id);
    if (!share) throw new ConnectError(`no share ${id}`, Code.NotFound);
    return share;
  }

  return {
    // Invalid input throws a ZodError, turned into invalid_argument by rpc/errors.ts.
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
        throw new ConnectError("identification still in progress", Code.FailedPrecondition);
      }
      await shares.requeue(req.id);
      queue.wake();
      return { share: toMessage(await getOrFail(req.id)) };
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
