import { type Dependency, DependencyState } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { dependenciesQuery } from "../queries/settings";

// One complete class string per state: Tailwind only generates classes written out in full.
export const DOTS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "bg-text-muted",
  [DependencyState.OK]: "bg-status-ok",
  [DependencyState.NOT_CONFIGURED]: "bg-status-ready",
  [DependencyState.ERROR]: "bg-status-error",
};

// The worst state wins: one error turns the header's dot red.
function overallState(dependencies: Dependency[]): DependencyState {
  if (dependencies.some((d) => d.state === DependencyState.ERROR)) return DependencyState.ERROR;
  if (dependencies.some((d) => d.state === DependencyState.NOT_CONFIGURED)) {
    return DependencyState.NOT_CONFIGURED;
  }
  return DependencyState.OK;
}

// "All working", or how many services need a look.
function summaryOf(dependencies: Dependency[]): string {
  const failing = dependencies.filter((d) => d.state !== DependencyState.OK).length;
  if (failing === 0) return "All working";
  return failing === 1 ? "1 issue" : `${failing} issues`;
}

// The Settings tab where a service is set up. yt-dlp and ffmpeg have none:
// they come with Spotarr.
const SECTIONS: Record<string, "identification" | "connections"> = {
  LLM: "identification",
  TMDB: "identification",
  Seerr: "connections",
  Jellyfin: "connections",
};

const closePanel = () => document.getElementById("services-status")?.hidePopover();

// The header's dot: whether every service Spotarr needs answers, on every
// page. A click opens the list; a service that does not work links to its
// Settings tab. The check pings the LLM: see dependenciesQuery for when it runs.
export function ServicesStatus() {
  const { data, isFetching, refetch } = useQuery(dependenciesQuery());
  const dependencies = data?.dependencies ?? [];
  const state = data ? overallState(dependencies) : DependencyState.UNSPECIFIED;
  const summary = data ? summaryOf(dependencies) : "Checking…";

  return (
    <>
      <button
        type="button"
        popoverTarget="services-status"
        aria-label={`Services: ${summary}`}
        style={{ anchorName: "--services-status" }}
        className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-text-muted hover:bg-text/8 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="relative flex size-2.5">
          {state === DependencyState.ERROR && (
            <span className="absolute inset-0 animate-ping rounded-full bg-status-error opacity-60" />
          )}
          <span
            className={`relative size-2.5 rounded-full ${DOTS[state]} ${!data ? "animate-pulse" : ""}`}
          />
        </span>
        <span className="hidden md:inline">{summary}</span>
      </button>

      <div
        id="services-status"
        popover="auto"
        // Under the dot: across the screen on a phone, its right edge on the
        // dot's from md up. A popover's default inset would pin it left.
        style={{ positionAnchor: "--services-status" }}
        className="m-0 mt-2 rounded-xl border border-border bg-surface-raised p-0 text-text shadow-lg [top:anchor(bottom)] inset-x-4 w-auto md:left-auto md:w-72 md:[right:anchor(right)]"
      >
        <div className="flex items-center justify-between border-b border-divider px-4 py-3">
          <p className="text-sm font-semibold">Services</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Check again"
            className="flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-text/8 hover:text-text"
          >
            <RefreshCw aria-hidden className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
        {!data && <p className="px-4 py-3 text-sm text-text-muted">Checking…</p>}
        <ul className="flex flex-col py-1">
          {dependencies.map((dependency) => (
            <li key={dependency.name} className="flex items-start gap-3 px-4 py-2 text-sm">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${DOTS[dependency.state]}`} />
              <span className="w-14 shrink-0 font-medium">{dependency.name}</span>
              {/* An error is what to read: it wraps, where a version is cut. */}
              {dependency.state === DependencyState.OK ? (
                <span title={dependency.detail} className="min-w-0 flex-1 truncate text-text-muted">
                  {dependency.detail}
                </span>
              ) : (
                <span className="min-w-0 flex-1 text-status-error">{dependency.detail}</span>
              )}
              {dependency.state !== DependencyState.OK && SECTIONS[dependency.name] && (
                <Link
                  to="/settings"
                  search={{ section: SECTIONS[dependency.name] }}
                  onClick={closePanel}
                  className="shrink-0 font-medium text-text-muted hover:text-text"
                >
                  Fix →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
