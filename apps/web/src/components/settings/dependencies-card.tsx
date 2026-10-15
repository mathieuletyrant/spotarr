import { DependencyState } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, RefreshCw } from "lucide-react";
import { dependenciesQuery } from "../../queries/settings";
import { Section } from "./fields";

const LABELS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "",
  [DependencyState.OK]: "Working",
  [DependencyState.NOT_CONFIGURED]: "To set up",
  [DependencyState.ERROR]: "Error",
};

// The state's color at 12 % behind its text, like the History's badges.
// One complete class string each: Tailwind only generates classes written out in full.
const PILLS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "",
  [DependencyState.OK]: "bg-status-ok/12 text-status-ok",
  [DependencyState.NOT_CONFIGURED]: "bg-status-ready/12 text-status-ready",
  [DependencyState.ERROR]: "bg-status-error/12 text-status-error",
};

// The tab where a Dependency's settings are. yt-dlp and ffmpeg have none:
// they come with Spotarr.
const SECTIONS: Record<string, "identification" | "seerr"> = {
  LLM: "identification",
  TMDB: "identification",
  Seerr: "seerr",
};

// Whether each Dependency works, checked when the page opens, and what the LLM cost.
export function DependenciesCard() {
  const { data, isFetching, error, refetch } = useQuery(dependenciesQuery());

  return (
    <Section
      id="status"
      icon={<Activity aria-hidden className="size-5" />}
      title="Status"
      description="Whether each service Spotarr needs answers, checked when the page opens."
      action={
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium whitespace-nowrap hover:bg-surface"
        >
          <RefreshCw aria-hidden className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Checking…" : "Check again"}
        </button>
      }
    >
      <div className="md:col-span-2">
        {error && <p className="text-sm text-status-error">{error.message}</p>}
        {!data && !error && <p className="text-sm text-text-muted">Checking…</p>}
        {data && (
          <ul className="divide-y divide-divider rounded-lg border border-border">
            {data.dependencies.map((dependency) => (
              <li key={dependency.name} className="flex items-center gap-4 px-4 py-3">
                <span className="w-16 shrink-0 font-medium">{dependency.name}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                  {dependency.detail}
                </span>
                <DependencyPill name={dependency.name} state={dependency.state} />
              </li>
            ))}
          </ul>
        )}
        {data?.llmCost && (
          <p className="mt-3 text-sm text-text-muted">
            LLM cost over the last 30 days: ${data.llmCost.totalUsd.toFixed(2)} for{" "}
            {data.llmCost.identifications} identifications, about $
            {(data.llmCost.totalUsd / data.llmCost.identifications).toFixed(4)} each.
          </p>
        )}
      </div>
    </Section>
  );
}

// Its state; one that does not work links to the tab that sets it up.
function DependencyPill({ name, state }: { name: string; state: DependencyState }) {
  const className = `shrink-0 rounded-full px-2.5 py-0.5 text-sm font-medium ${PILLS[state]}`;
  const section = SECTIONS[name];
  if (state === DependencyState.OK || !section) {
    return <span className={className}>{LABELS[state]}</span>;
  }
  return (
    <Link
      to="/settings"
      search={{ section }}
      className={`${className} underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent`}
    >
      {LABELS[state]} →
    </Link>
  );
}
