import { Summary } from "@spotarr/contract";

// Label and colors of each Summary, in the order of the history's filters.
// Tailwind only generates classes it finds written out in full: hence one
// complete class string per state, never `text-status-${…}`.
export const SUMMARIES = [
  {
    summary: Summary.IN_PROGRESS,
    label: "In progress",
    className: "bg-status-progress/15 text-status-progress",
  },
  { summary: Summary.ADDED, label: "Added", className: "bg-status-added/15 text-status-added" },
  {
    summary: Summary.REQUESTED,
    label: "Requested",
    className: "bg-status-requested/15 text-status-requested",
  },
  {
    summary: Summary.ALREADY_PRESENT,
    label: "Already present",
    className: "bg-status-present/15 text-status-present",
  },
  {
    summary: Summary.TO_CHOOSE,
    label: "To choose",
    className: "bg-status-ready/15 text-status-ready",
  },
  {
    summary: Summary.NO_MATCH,
    label: "No match",
    className: "border border-dashed border-status-no-match text-status-no-match",
  },
  { summary: Summary.FAILED, label: "Failed", className: "bg-status-error/15 text-status-error" },
];

export function summaryStyle(summary: Summary) {
  return SUMMARIES.find((s) => s.summary === summary) ?? { label: "", className: "" };
}
