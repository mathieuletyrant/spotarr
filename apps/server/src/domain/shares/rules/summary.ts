import type { Addition, Candidate, IdentificationStatus, Share, Summary } from "../types";

// What the history shows for a Share. The first rule that applies wins.
export function summaryOf(
  status: IdentificationStatus,
  candidates: Candidate[],
  additions: Addition[],
): Summary {
  if (status === "QUEUED" || status === "PROCESSING") return "IN_PROGRESS";

  const latestAddition = additions.at(-1);
  if (latestAddition) return latestAddition.status;

  if (status === "FAILED") return "FAILED";
  if (status === "NO_MATCH") return "NO_MATCH";

  const best = candidates[0];
  if (best?.libraryState === "AVAILABLE" || best?.libraryState === "PARTIAL") {
    return "ALREADY_PRESENT";
  }
  return "TO_CHOOSE";
}

export type CandidateStatus = {
  status: "CAN_ADD" | "REQUESTED" | "ADDED" | "ALREADY_PRESENT";
  // Requested or added by auto add, without a click.
  automatic: boolean;
  // CAN_ADD after a failed Addition: its error.
  failure?: string;
};

// Where a Candidate stands, for the Share's page. Its latest Addition decides
// first, then its Library state.
export function candidateStatusOf(candidate: Candidate, additions: Addition[]): CandidateStatus {
  const addition = additions.findLast(
    (a) => a.tmdbId === candidate.tmdbId && a.type === candidate.type,
  );
  if (addition?.status === "REQUESTED" || addition?.status === "ADDED") {
    return { status: addition.status, automatic: addition.automatic };
  }
  if (addition?.status === "ALREADY_PRESENT")
    return { status: "ALREADY_PRESENT", automatic: false };
  if (candidate.libraryState === "AVAILABLE" || candidate.libraryState === "PARTIAL") {
    return { status: "ALREADY_PRESENT", automatic: false };
  }
  if (candidate.libraryState === "REQUESTED") return { status: "REQUESTED", automatic: false };
  if (addition?.status === "FAILED") {
    return { status: "CAN_ADD", automatic: false, failure: addition.error };
  }
  return { status: "CAN_ADD", automatic: false };
}

// Additions that put a Candidate in the library or found it there already:
// the "2/3" of the history.
export function addedCountOf(additions: Addition[]): number {
  return additions.filter((a) => a.status !== "FAILED").length;
}

// Why a FAILED Share failed: its latest Addition's error, else the Identification's.
export function failureReasonOf(share: Share): string | undefined {
  if (share.summary !== "FAILED") return undefined;
  return share.additions.at(-1)?.error ?? share.identification.error;
}
