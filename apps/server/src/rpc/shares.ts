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
import { parseInput } from "../shares/input";
import type { ShareQueue } from "../shares/queue";
import type { ShareRepository } from "../shares/repository";
import type { Share } from "../shares/types";
import type { Rpcs } from "./types";

export function shareRpcs(
  shares: ShareRepository,
  queue: ShareQueue,
): Rpcs<"createShare" | "getShare" | "listShares" | "retryIdentification"> {
  const found = async (id: string) => {
    const share = await shares.get(id);
    if (!share) throw new ConnectError(`no share ${id}`, Code.NotFound);
    return toMessage(share);
  };

  return {
    // Invalid input throws a ZodError, turned into invalid_argument by rpc/errors.ts.
    createShare: async (req) => {
      const { input, source } = parseInput(req);
      const share = await shares.create(input, source);
      queue.wake();
      return { share: toMessage(share) };
    },

    getShare: async (req) => ({ share: await found(req.id) }),

    listShares: async (req) => {
      const limit = Math.min(req.pageSize ?? 50, 100);
      // One extra row tells whether a next page exists.
      const page = await shares.list({
        limit: limit + 1,
        after: req.cursor,
        summaries: req.summaries
          .filter((s) => s !== Summary.UNSPECIFIED)
          .map((s) => Summary[s] as Share["summary"]),
        query: req.query?.trim() || undefined,
      });
      const hasMore = page.length > limit;
      const shown = page.slice(0, limit);
      return {
        shares: shown.map(toMessage),
        nextCursor: hasMore ? shown.at(-1)?.id : undefined,
      };
    },

    retryIdentification: async (req) => {
      const outcome = await shares.requeue(req.id);
      if (outcome === "missing") throw new ConnectError(`no share ${req.id}`, Code.NotFound);
      if (outcome === "busy") {
        throw new ConnectError("identification still in progress", Code.FailedPrecondition);
      }
      queue.wake();
      return { share: await found(req.id) };
    },
  };
}

// Domain values are plain strings ("READY"); the contract's enums are numbers
// whose names match them (IdentificationStatus.READY), so the lookup is by name.
function toMessage(share: Share) {
  const { identification: idf } = share;
  return {
    id: share.id,
    createdAt: timestampFromDate(new Date(share.createdAt)),
    input: share.input,
    source: share.source,
    identification: {
      ...idf,
      status: IdentificationStatus[idf.status],
      method: idf.method ? Method[idf.method] : Method.UNSPECIFIED,
    },
    candidates: share.candidates.map((c) => ({
      ...c,
      type: MediaType[c.type],
      libraryState: LibraryState[c.libraryState],
    })),
    additions: share.additions.map((a) => ({
      ...a,
      createdAt: timestampFromDate(new Date(a.createdAt)),
      type: MediaType[a.type],
      target: Target[a.target],
      status: AdditionStatus[a.status],
    })),
    summary: Summary[share.summary],
  };
}
