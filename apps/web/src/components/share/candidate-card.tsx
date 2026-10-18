import { useMutation } from "@connectrpc/connect-query";
import {
  type Candidate,
  CandidateStatus,
  MediaType,
  type Share,
  SpotarrService,
  Summary,
} from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Play, Plus } from "lucide-react";
import { watchLinksQuery } from "../../queries/shares";
import { Genres } from "../genres";
import { Poster } from "../poster";
import { StatusBadge } from "../status-badge";
import { TmdbRating } from "../tmdb-rating";

// One Candidate: poster, titles, TMDB rating, confidence, and what can be done with it.
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
            className="group inline-flex items-center gap-1.5 text-lg font-semibold hover:underline"
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
        <TmdbRating rating={candidate.tmdbRating} votes={candidate.tmdbVotes} />
        <Genres genres={candidate.genres} />
        <Confidence value={candidate.confidence} />
        <WatchLinks candidate={candidate} />
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
      <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border sm:w-32">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span className="whitespace-nowrap">Confidence {percent} %</span>
    </div>
  );
}

// Where the title can be watched already: the library, the Platforms subscribed
// to. Nothing while asking, nor when TMDB or Seerr cannot say.
function WatchLinks({ candidate }: { candidate: Candidate }) {
  const { data } = useQuery(watchLinksQuery(candidate.tmdbId, candidate.type));
  const links = data?.links ?? [];
  if (links.length === 0) return null;
  return (
    <ul aria-label="Watch on" className="mt-2 flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.name}>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-2 rounded-full border border-border pr-3 pl-1 text-sm whitespace-nowrap hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {link.logoUrl ? (
              <img src={link.logoUrl} alt="" className="size-6 rounded-full" />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Play aria-hidden className="size-3" />
              </span>
            )}
            Watch on {link.name}
            <span className="sr-only">(opens a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// "Add", or where the title stands: requested, available, failed.
function CandidateAction({ share, candidate }: { share: Share; candidate: Candidate }) {
  const queryClient = useQueryClient();
  const add = useMutation(SpotarrService.method.add, {
    onSuccess: () => queryClient.invalidateQueries(),
  });

  if (candidate.status === CandidateStatus.REQUESTED) {
    return (
      <div className="flex flex-col items-end gap-1">
        <StatusBadge summary={Summary.REQUESTED} />
        {candidate.automatic && (
          <span className="text-xs text-text-muted">
            {candidate.rule ? `by ${candidate.rule}` : "automatically"}
          </span>
        )}
      </div>
    );
  }
  if (candidate.status === CandidateStatus.ADDED) return <StatusBadge summary={Summary.ADDED} />;
  if (candidate.status === CandidateStatus.ALREADY_PRESENT) {
    return <StatusBadge summary={Summary.ALREADY_PRESENT} />;
  }

  // The last failed Addition, else the click that just failed.
  const failure = candidate.failure ?? add.error?.message;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() =>
          add.mutate({ shareId: share.id, tmdbId: candidate.tmdbId, type: candidate.type })
        }
        disabled={add.isPending}
        className="flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 font-medium text-accent-text"
      >
        <Plus aria-hidden className="size-4" />
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
