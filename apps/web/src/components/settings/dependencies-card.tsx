import { DependencyState } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { dependenciesQuery } from "../../queries/settings";

const LABELS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "",
  [DependencyState.OK]: "Working",
  [DependencyState.NOT_CONFIGURED]: "To set up",
  [DependencyState.ERROR]: "Error",
};

// One complete class string per state: Tailwind only generates classes written out in full.
const DOTS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "",
  [DependencyState.OK]: "bg-status-ok",
  [DependencyState.NOT_CONFIGURED]: "border-2 border-status-ready",
  [DependencyState.ERROR]: "bg-status-error",
};

const TEXTS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "",
  [DependencyState.OK]: "text-status-ok",
  [DependencyState.NOT_CONFIGURED]: "text-status-ready",
  [DependencyState.ERROR]: "text-status-error",
};

// Whether each Dependency works, checked when the page opens, and what the LLM cost.
export function DependenciesCard() {
  const { data, isFetching, error, refetch } = useQuery(dependenciesQuery());

  return (
    <section
      id="status"
      className="scroll-mt-6 rounded-lg border border-border bg-surface-raised p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Status</h2>
          <p className="mt-1 text-sm text-text-muted">Checked when the page opens.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 shrink-0 rounded-md border border-border px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {isFetching ? "Checking…" : "Check again"}
        </button>
      </div>

      {error && <p className="text-sm text-status-error">{error.message}</p>}
      {!data && !error && <p className="text-sm text-text-muted">Checking…</p>}

      {data && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.dependencies.map((dependency) => (
            <li key={dependency.name} className="rounded-md border border-border p-3">
              <p className="font-medium">{dependency.name}</p>
              <p className={`mt-1 flex items-center gap-2 text-sm ${TEXTS[dependency.state]}`}>
                <span aria-hidden className={`size-2 rounded-full ${DOTS[dependency.state]}`} />
                {LABELS[dependency.state]}
              </p>
              <p className="mt-1 text-sm break-words text-text-muted">{dependency.detail}</p>
            </li>
          ))}
        </ul>
      )}

      {data?.llmCost && (
        <p className="mt-4 text-sm text-text-muted">
          LLM cost over the last 30 days: ${data.llmCost.totalUsd.toFixed(2)} for{" "}
          {data.llmCost.identifications} identifications, about $
          {(data.llmCost.totalUsd / data.llmCost.identifications).toFixed(4)} each.
        </p>
      )}
    </section>
  );
}
