import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import {
  AdditionStatus,
  CandidateStatus,
  IdentificationStatus,
  LibraryState,
  MediaType,
  Method,
  Summary,
  Target,
} from "@spotarr/contract";
import { addedCountOf, candidateStatusOf, failureReasonOf } from "../domain/shares/rules/summary";
import type { Addition, Candidate, Share } from "../domain/shares/types";

// The one place that turns the domain's Shares into the contract's messages,
// for the RPCs and for the Webhooks alike: a field added here reaches both.
// The domain writes enum values as names ("READY"), the contract as numbers.
// Each enum of the contract maps a name to its number: IdentificationStatus["READY"] is 3.

export function shareMessage(share: Share) {
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
    candidates: share.candidates.map((candidate) => candidateMessage(candidate, share.additions)),
    additions: share.additions.map((addition) => ({
      ...addition,
      createdAt: timestampFromDate(new Date(addition.createdAt)),
      type: MediaType[addition.type],
      target: Target[addition.target],
      status: AdditionStatus[addition.status],
    })),
    frames: share.frames.map((frame) => ({
      atSeconds: frame.atMs / 1000,
      url: `/frames/${share.id}/${frame.position}.jpg`,
    })),
    summary: Summary[share.summary],
    failureReason: failureReasonOf(share),
    addedCount: addedCountOf(share.additions),
  };
}

// A Candidate, with its Candidate status: `additions` are its Share's.
export function candidateMessage(candidate: Candidate, additions: Addition[]) {
  const { status, automatic, failure } = candidateStatusOf(candidate, additions);
  return {
    ...candidate,
    type: MediaType[candidate.type],
    libraryState: LibraryState[candidate.libraryState],
    status: CandidateStatus[status],
    automatic,
    failure,
  };
}
