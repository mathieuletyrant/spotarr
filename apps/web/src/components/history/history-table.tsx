import type { Share } from "@spotarr/contract";
import { HISTORY_COLUMNS } from "./columns";
import { ShareRow } from "./share-row";

export function HistoryTable({ shares }: { shares: Share[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <div
        className={`hidden border-b border-border px-4 py-3 text-xs font-semibold tracking-wide text-text-muted uppercase ${HISTORY_COLUMNS}`}
      >
        <span>Date</span>
        <span>Share</span>
        <span>Result</span>
        <span>Target</span>
        <span>Status</span>
        <span>Identification</span>
      </div>
      <ul className="divide-y divide-border">
        {shares.map((share) => (
          <ShareRow key={share.id} share={share} />
        ))}
      </ul>
    </div>
  );
}
