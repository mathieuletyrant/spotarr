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
import { Poster } from "../poster";
import { StatusBadge } from "../status-badge";
import { TmdbRating } from "../tmdb-rating";

// One Candidate beside its poster: the title, what it is, how sure Spotarr is,
// then where to watch it already and the action.
export function CandidateCard({ share, candidate }: { share: Share; candidate: Candidate }) {
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Poster title={candidate.title} url={candidate.posterUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={tmdbUrl(candidate)}
          target="_blank"
          rel="noreferrer"
          className="font-semibold leading-snug hover:underline md:text-lg"
        >
          {candidate.title}
          <span className="sr-only"> (on TMDB, opens a new tab)</span>
        </a>
        <p className="text-sm text-text-muted">{whatItIs(candidate)}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-text-muted">
          <TmdbRating rating={candidate.tmdbRating} votes={candidate.tmdbVotes} compact />
          <Confidence value={candidate.confidence} />
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <WatchLinks candidate={candidate} />
          <div className="ml-auto">
            <CandidateAction share={share} candidate={candidate} />
          </div>
        </div>
      </div>
    </li>
  );
}

// "2024 · TV show · Animation, Drame", with the original title first when it differs.
function whatItIs(candidate: Candidate): string {
  const parts: string[] = [];
  if (candidate.originalTitle && candidate.originalTitle !== candidate.title) {
    parts.push(candidate.originalTitle);
  }
  if (candidate.year) parts.push(String(candidate.year));
  parts.push(candidate.type === MediaType.TV ? "TV show" : "Movie");
  if (candidate.genres.length > 0) parts.push(candidate.genres.join(", "));
  return parts.join(" · ");
}

// How sure the Identification is; a direct IMDb or TMDB link is certain.
function Confidence({ value }: { value?: number }) {
  if (value === undefined) return <span>Direct link</span>;
  return <span>{Math.round(value * 100)} % sure</span>;
}

// Where the title can be watched already: the library, the Platforms subscribed
// to, by logo and name. Nothing while asking, nor when TMDB or Seerr cannot say.
function WatchLinks({ candidate }: { candidate: Candidate }) {
  const { data } = useQuery(watchLinksQuery(candidate.tmdbId, candidate.type));
  const links = data?.links ?? [];
  if (links.length === 0) return null;
  return (
    <ul aria-label="Watch on" className="flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.name} className="max-w-full">
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="group flex h-8 items-center gap-2 rounded-md border border-border pr-2 pl-1 text-sm hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {link.logoUrl ? (
              <img src={link.logoUrl} alt="" className="size-6 rounded-sm" />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-sm bg-accent/15 text-accent">
                <Play aria-hidden className="size-3" />
              </span>
            )}
            <span className="sr-only">Watch on</span>
            <span className="min-w-0 truncate">{link.name}</span>
            <ExternalLink
              aria-hidden
              className="size-3.5 shrink-0 text-text-muted group-hover:text-text"
            />
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
        className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-text"
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
