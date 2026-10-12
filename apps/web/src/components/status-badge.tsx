import { Summary } from "@spotarr/contract";
import { LoaderCircle } from "lucide-react";

export const SUMMARY_LABELS: Record<Summary, string> = {
  [Summary.UNSPECIFIED]: "",
  [Summary.IN_PROGRESS]: "In progress",
  [Summary.TO_CHOOSE]: "To choose",
  [Summary.ADDED]: "Added",
  [Summary.REQUESTED]: "Requested",
  [Summary.ALREADY_PRESENT]: "Already present",
  [Summary.NO_MATCH]: "No match",
  [Summary.FAILED]: "Failed",
};

// Tailwind only generates classes it finds written out in full: one complete
// class string per Summary, never `text-status-${…}`. Backgrounds are the
// status color at 12 %, as measured on the mockups.
const COLORS: Record<Summary, string> = {
  [Summary.UNSPECIFIED]: "",
  // Neutral in the mockup: only the spinning icon is colored.
  [Summary.IN_PROGRESS]: "bg-text/8 text-text",
  [Summary.TO_CHOOSE]: "bg-status-ready/12 text-status-ready",
  [Summary.ADDED]: "bg-status-added/12 text-status-added",
  [Summary.REQUESTED]: "bg-status-requested/12 text-status-requested",
  [Summary.ALREADY_PRESENT]: "bg-status-present/12 text-status-present",
  [Summary.NO_MATCH]: "border border-dashed border-status-no-match text-status-no-match",
  [Summary.FAILED]: "bg-status-error/12 text-status-error",
};

// The name of a Summary, e.g. "Already present".
export function SummaryLabel({ summary }: { summary: Summary }) {
  return SUMMARY_LABELS[summary];
}

// A colored pill with the Summary's name, e.g. "Requested 1/3".
export function StatusBadge({ summary, detail }: { summary: Summary; detail?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${COLORS[summary]}`}
    >
      {summary === Summary.IN_PROGRESS && (
        <LoaderCircle aria-hidden className="size-3.5 animate-spin text-status-progress" />
      )}
      <SummaryLabel summary={summary} />
      {detail && <span className="opacity-75">{detail}</span>}
    </span>
  );
}
