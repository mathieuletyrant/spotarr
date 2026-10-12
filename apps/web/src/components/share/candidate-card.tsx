import { useMutation } from "@connectrpc/connect-query";
import {
  type Addition,
  AdditionStatus,
  type Candidate,
  LibraryState,
  MediaType,
  type Share,
  SpotarrService,
  Summary,
} from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Poster } from "../poster";
import { StatusBadge } from "../status-badge";

// One Candidate: poster, titles, confidence, and what can be done with it.
export function CandidateCard({ share, candidate }: { share: Share; candidate: Candidate }) {
  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      <Poster title={candidate.title} url={candidate.posterUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <a
            href={tmdbUrl(candidate)}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1.5 text-lg font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {candidate.title}
            <ExternalLink aria-hidden className="size-3.5 text-text-muted group-hover:text-text" />
            <span className="sr-only">(on TMDB, opens a new tab)</span>
          </a>
          <span className="text-text-muted">{candidate.year}</span>
          <span className="rounded-sm border border-border px-1.5 text-xs text-text-muted">
            {candidate.type === MediaType.TV ? "TV show" : "Movie"}
          </span>
        </p>
        {candidate.originalTitle && candidate.originalTitle !== candidate.title && (
          <p className="text-sm text-text-muted">{candidate.originalTitle}</p>
        )}
        <Confidence value={candidate.confidence} />
      </div>
      <div className="shrink-0">
        <CandidateAction share={share} candidate={candidate} />
      </div>
    </li>
  );
}

// A bar and a percentage; a direct IMDb or TMDB link is certain.
function Confidence({ value }: { value?: number }) {
  if (value === undefined)
    return <p className="mt-2 text-sm text-text-muted">Certain: direct link</p>;
  const percent = Math.round(value * 100);
  return (
    <div className="mt-2 flex items-center gap-3 text-sm">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border sm:w-32">
        <div className="h-full rounded-full bg-text" style={{ width: `${percent}%` }} />
      </div>
      <span className="whitespace-nowrap">Confidence {percent} %</span>
    </div>
  );
}

// "Add", or where the title stands: requested, already in the library, failed.
function CandidateAction({ share, candidate }: { share: Share; candidate: Candidate }) {
  const queryClient = useQueryClient();
  const add = useMutation(SpotarrService.method.add, {
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const addition = latestAdditionOf(share, candidate);
  if (addition?.status === AdditionStatus.REQUESTED)
    return <StatusBadge summary={Summary.REQUESTED} />;
  if (addition?.status === AdditionStatus.ADDED) return <StatusBadge summary={Summary.ADDED} />;
  if (addition?.status === AdditionStatus.ALREADY_PRESENT || inLibrary(candidate)) {
    return <StatusBadge summary={Summary.ALREADY_PRESENT} />;
  }
  if (candidate.libraryState === LibraryState.REQUESTED)
    return <StatusBadge summary={Summary.REQUESTED} />;

  const failure = addition?.status === AdditionStatus.FAILED ? addition.error : add.error?.message;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() =>
          add.mutate({ shareId: share.id, tmdbId: candidate.tmdbId, type: candidate.type })
        }
        disabled={add.isPending}
        className="h-10 rounded-md border border-border px-4 font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
      >
        {add.isPending ? "Adding…" : failure ? "Try again" : "Add"}
      </button>
      {failure && <p className="max-w-48 text-right text-xs text-status-error">{failure}</p>}
    </div>
  );
}

// The Candidate's page on TMDB.
function tmdbUrl(candidate: Candidate): string {
  const kind = candidate.type === MediaType.TV ? "tv" : "movie";
  return `https://www.themoviedb.org/${kind}/${candidate.tmdbId}`;
}

function latestAdditionOf(share: Share, candidate: Candidate): Addition | undefined {
  return share.additions.findLast(
    (a) => a.tmdbId === candidate.tmdbId && a.type === candidate.type,
  );
}

function inLibrary(candidate: Candidate): boolean {
  return (
    candidate.libraryState === LibraryState.AVAILABLE ||
    candidate.libraryState === LibraryState.PARTIAL
  );
}
