import type { Addition, Candidate, IdentificationStatus, Summary } from "./types";

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
