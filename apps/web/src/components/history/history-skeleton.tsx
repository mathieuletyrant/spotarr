// Five grey rows the shape of the table's, while the first page loads: the
// page keeps its height instead of jumping when the Shares arrive.
export function HistorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the history"
      className="overflow-hidden rounded-lg border border-border bg-surface-raised"
    >
      <ul className="animate-pulse divide-y divide-divider motion-reduce:animate-none">
        {[1, 2, 3, 4, 5].map((row) => (
          <li key={row} className="flex items-center gap-3 p-3 lg:px-4 lg:py-4">
            <div aria-hidden className="h-27 w-18 shrink-0 rounded-md bg-text/8 lg:h-21 lg:w-14" />
            <div aria-hidden className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-1/2 max-w-64 rounded-sm bg-text/8" />
              <div className="h-3 w-1/3 max-w-40 rounded-sm bg-text/8" />
              <div className="h-5 w-20 rounded-full bg-text/8" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
