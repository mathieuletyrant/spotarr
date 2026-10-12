import { Summary } from "@spotarr/contract";
import { LoaderCircle } from "lucide-react";
import { summaryStyle } from "../lib/summary";

// A colored pill with the Summary's label, e.g. "Requested 1/3".
export function StatusBadge({ summary, detail }: { summary: Summary; detail?: string }) {
  const { label, className } = summaryStyle(summary);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${className}`}
    >
      {summary === Summary.IN_PROGRESS && (
        <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
      )}
      {label}
      {detail && <span className="opacity-75">{detail}</span>}
    </span>
  );
}
