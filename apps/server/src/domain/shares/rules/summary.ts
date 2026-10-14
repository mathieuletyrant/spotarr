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
  // Requested or added by auto add, without a click, and by which Rule.
  automatic: boolean;
  rule?: string;
  // CAN_ADD after a failed Addition: its error.
  failure?: string;
};

// Where a Candidate stands, for the Share's page. Its latest Addition decides
// first, then its Library state.
export function candidateStatusOf(candidate: Candidate, additions: Addition[]): CandidateStatus {
  const addition = latestAdditionOf(candidate, additions);
  if (addition?.status === "REQUESTED" || addition?.status === "ADDED") {
    return { status: addition.status, automatic: addition.automatic, rule: addition.rule };
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

// Candidates whose latest Addition put them in the library or found them
// there already: the "2/3" of the history. Counted per Candidate, so a retry
// that kept old Additions never makes it "3/2".
export function addedCountOf(candidates: Candidate[], additions: Addition[]): number {
  return candidates.filter((candidate) => {
    const addition = latestAdditionOf(candidate, additions);
    return addition !== undefined && addition.status !== "FAILED";
  }).length;
}

// A TMDB id names a movie and a TV show alike: the type tells them apart.
function latestAdditionOf(candidate: Candidate, additions: Addition[]): Addition | undefined {
  return additions.findLast((a) => a.tmdbId === candidate.tmdbId && a.type === candidate.type);
}

// Why a FAILED Share failed: its latest Addition's error, else the Identification's.
export function failureReasonOf(share: Share): string | undefined {
  if (share.summary !== "FAILED") return undefined;
  return share.additions.at(-1)?.error ?? share.identification.error;
}
