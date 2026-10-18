import { useMutation } from "@connectrpc/connect-query";
import {
  type Candidate,
  CandidateStatus,
  MediaType,
  RuleAction,
  type Share,
  SpotarrService,
  Summary,
  type WatchLink,
} from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Play, Plus } from "lucide-react";
import { watchLinksQuery } from "../../queries/shares";
import { Poster } from "../poster";
import { StatusBadge } from "../status-badge";
import { TmdbRating } from "../tmdb-rating";

// The Candidates of a Share. The first, the most likely (the Identification
// sorts them by confidence), takes the stage with one big action: watch it
// where it already is, else add it to the library or to Seerr's watchlist, the
// same two Actions as a Rule's. The others get one line each.
export function Candidates({ share }: { share: Share }) {
  const [best, ...others] = share.candidates;
  if (!best) return null;
  return (
    <div className="flex flex-col gap-6">
      <BestMatch share={share} candidate={best} />
      {others.length > 0 && (
        <div className="border-t border-divider pt-4">
          <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
            Other candidates
          </h3>
          <ul className="mt-1 divide-y divide-divider">
            {others.map((candidate) => (
              <OtherCandidate
                key={`${candidate.type}-${candidate.tmdbId}`}
                share={share}
                candidate={candidate}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The poster beside the title and what it is; the actions under them on a
// phone, under the text from md up.
function BestMatch({ share, candidate }: { share: Share; candidate: Candidate }) {
  const { data } = useQuery(watchLinksQuery(candidate.tmdbId, candidate.type));
  const links = data?.links ?? [];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">
        Best match · {confidenceText(candidate.confidence)}
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4">
        <div className={links.length > 0 ? "md:row-span-2" : "row-span-2"}>
          <Poster title={candidate.title} url={candidate.posterUrl} size="hero" />
        </div>
        <div className="flex flex-col gap-1.5">
          <a
            href={tmdbUrl(candidate)}
            target="_blank"
            rel="noreferrer"
            className="text-xl leading-tight font-semibold hover:underline md:text-2xl"
          >
            {candidate.title}
            <span className="sr-only"> (on TMDB, opens a new tab)</span>
          </a>
          <p className="text-sm text-text-muted">{whatItIs(candidate)}</p>
          <TmdbRating rating={candidate.tmdbRating} votes={candidate.tmdbVotes} />
          {candidate.overview && (
            <p className="mt-1 hidden text-sm leading-relaxed md:line-clamp-3">
              {candidate.overview}
            </p>
          )}
        </div>
        {/* A big Watch button takes a phone's width; a lone Add stays beside the poster. */}
        <div
          className={links.length > 0 ? "col-span-2 md:col-span-1 md:col-start-2" : "col-start-2"}
        >
          <BestMatchActions share={share} candidate={candidate} links={links} />
        </div>
      </div>
    </div>
  );
}

// Watch it where it already is, else add it to the library or the watchlist.
// Adding stays possible, quieter, when it can be watched.
function BestMatchActions({
  share,
  candidate,
  links,
}: {
  share: Share;
  candidate: Candidate;
  links: WatchLink[];
}) {
  const add = useAdd(share, candidate, RuleAction.SEERR_REQUEST);
  const watch = useAdd(share, candidate, RuleAction.SEERR_WATCHLIST);
  const [first, ...more] = links;
  const canAdd = candidate.status === CandidateStatus.CAN_ADD;
  const failure = candidate.failure ?? add.error?.message;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {first && (
          <a
            href={first.url}
            target="_blank"
            rel="noreferrer"
            className={`${BIG_BUTTON} flex-1 bg-accent text-accent-text md:flex-none`}
          >
            <LinkLogo link={first} />
            Watch on {first.name}
            <span className="sr-only">(opens a new tab)</span>
          </a>
        )}
        {more.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className={`${BIG_BUTTON} border border-border hover:bg-text/8`}
          >
            <LinkLogo link={link} />
            {link.name}
            <span className="sr-only">(watch there, opens a new tab)</span>
          </a>
        ))}
        {canAdd && !first && (
          <button
            type="button"
            onClick={add.start}
            disabled={add.isPending}
            className="flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus aria-hidden className="size-4" />
            {add.isPending ? "Adding…" : failure ? "Try again" : "Add to the library"}
          </button>
        )}
        {canAdd && !first && <WatchButton watch={watch} />}
        {!canAdd && <Status candidate={candidate} />}
      </div>
      {canAdd && first && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 self-center md:self-start">
          <button
            type="button"
            onClick={add.start}
            disabled={add.isPending}
            className="text-sm text-text-muted underline hover:text-text"
          >
            {add.isPending ? "Adding…" : failure ? "Try adding again" : "Add to the library anyway"}
          </button>
          {watch.isDone ? (
            <InWatchlist />
          ) : (
            <button
              type="button"
              onClick={watch.start}
              disabled={watch.isPending}
              className="text-sm text-text-muted underline hover:text-text"
            >
              {watch.isPending ? "Adding…" : "Add to Seerr's watchlist"}
            </button>
          )}
        </div>
      )}
      {failure && <p className="text-sm text-status-error">{failure}</p>}
      {watch.error && <p className="text-sm text-status-error">{watch.error.message}</p>}
    </div>
  );
}

// "Add to Seerr's watchlist", then "In watchlist" once Seerr took it.
function WatchButton({ watch }: { watch: ReturnType<typeof useAdd> }) {
  if (watch.isDone) return <InWatchlist />;
  return (
    <button
      type="button"
      onClick={watch.start}
      disabled={watch.isPending}
      className="flex h-10 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Bookmark aria-hidden className="size-4" />
      {watch.isPending ? "Adding…" : "Add to Seerr's watchlist"}
    </button>
  );
}

// Spotarr keeps no trace of the watchlist: this shows only until the page reloads.
function InWatchlist() {
  return (
    <span className="flex items-center gap-1.5 text-sm text-text-muted">
      <BookmarkCheck aria-hidden className="size-4" />
      In watchlist
    </span>
  );
}

const BIG_BUTTON =
  "flex h-11 items-center justify-center gap-2 rounded-md px-4 font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent";

// One line: a small poster, the title, what it is and how sure; where to
// watch it by logo, then Add or where it stands.
function OtherCandidate({ share, candidate }: { share: Share; candidate: Candidate }) {
  const { data } = useQuery(watchLinksQuery(candidate.tmdbId, candidate.type));
  const links = data?.links ?? [];
  return (
    <li className="flex items-center gap-3 py-3">
      <Poster title={candidate.title} url={candidate.posterUrl} size="small" />
      <div className="min-w-0 flex-1">
        <a
          href={tmdbUrl(candidate)}
          target="_blank"
          rel="noreferrer"
          className="block truncate font-medium hover:underline"
        >
          {candidate.title}
          <span className="sr-only"> (on TMDB, opens a new tab)</span>
        </a>
        <p className="text-sm text-text-muted">
          {[candidate.year, typeName(candidate), confidenceText(candidate.confidence)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={`Watch on ${link.name}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border pr-2 pl-1 text-sm hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <LinkLogo link={link} />
          <span className="sr-only">Watch on</span>
          {/* A logo says enough on a phone; the library has none, so its name shows. */}
          <span className={link.logoUrl ? "sr-only md:not-sr-only" : ""}>{link.name}</span>
          <span className="sr-only">(opens a new tab)</span>
        </a>
      ))}
      {/* A link to watch it already says it is in the library. */}
      {!(candidate.status === CandidateStatus.ALREADY_PRESENT && links.length > 0) && (
        <div className="shrink-0">
          <SmallAction share={share} candidate={candidate} />
        </div>
      )}
    </li>
  );
}

// Add to the library or to the watchlist: icons alone on a phone, a word
// beside them from md up.
function SmallAction({ share, candidate }: { share: Share; candidate: Candidate }) {
  const add = useAdd(share, candidate, RuleAction.SEERR_REQUEST);
  const watch = useAdd(share, candidate, RuleAction.SEERR_WATCHLIST);
  if (candidate.status !== CandidateStatus.CAN_ADD) return <Status candidate={candidate} />;
  const failure = candidate.failure ?? add.error?.message;
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={add.start}
        disabled={add.isPending}
        title={failure ?? "Add to the library"}
        className="flex h-9 items-center gap-1 rounded-md bg-accent px-2.5 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Plus aria-hidden className="size-4" />
        <span className="sr-only md:not-sr-only">
          {add.isPending ? "Adding…" : failure ? "Retry" : "Library"}
        </span>
        <span className="sr-only"> (add to the library)</span>
      </button>
      {watch.isDone ? (
        <span title="In Seerr's watchlist" className="flex h-9 items-center px-2 text-text-muted">
          <BookmarkCheck aria-hidden className="size-4" />
          <span className="sr-only">In Seerr's watchlist</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={watch.start}
          disabled={watch.isPending}
          title={watch.error?.message ?? "Add to Seerr's watchlist"}
          className="flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Bookmark aria-hidden className="size-4" />
          <span className="sr-only md:not-sr-only">
            {watch.isPending ? "Adding…" : watch.error ? "Retry" : "Watchlist"}
          </span>
          <span className="sr-only"> (add to Seerr's watchlist)</span>
        </button>
      )}
    </div>
  );
}

// Where a Candidate stands once it is no longer to add, and who added it.
function Status({ candidate }: { candidate: Candidate }) {
  if (candidate.status === CandidateStatus.REQUESTED) {
    return (
      <span className="flex items-center gap-2">
        <StatusBadge summary={Summary.REQUESTED} />
        {candidate.automatic && (
          <span className="text-xs text-text-muted">
            {candidate.rule ? `by ${candidate.rule}` : "automatically"}
          </span>
        )}
      </span>
    );
  }
  if (candidate.status === CandidateStatus.ADDED) return <StatusBadge summary={Summary.ADDED} />;
  return <StatusBadge summary={Summary.ALREADY_PRESENT} />;
}

// The platform's logo, else a filled play sign in a logo's space: the library
// has none. The sign takes the button's text color, so it shows on any button.
function LinkLogo({ link }: { link: WatchLink }) {
  if (link.logoUrl) return <img src={link.logoUrl} alt="" className="size-7 rounded-sm" />;
  return (
    <span className="flex size-7 items-center justify-center">
      <Play aria-hidden className="size-5" fill="currentColor" />
    </span>
  );
}

// Adds the Candidate through Seerr, requested or in its watchlist, then
// refreshes the Share.
function useAdd(share: Share, candidate: Candidate, action: RuleAction) {
  const queryClient = useQueryClient();
  const add = useMutation(SpotarrService.method.add, {
    onSuccess: () => queryClient.invalidateQueries(),
  });
  return {
    start: () =>
      add.mutate({ shareId: share.id, tmdbId: candidate.tmdbId, type: candidate.type, action }),
    isPending: add.isPending,
    isDone: add.isSuccess,
    error: add.error,
  };
}

// "2001 · Movie · Animation, Fantastique", the original title first when it differs.
function whatItIs(candidate: Candidate): string {
  const parts: string[] = [];
  if (candidate.originalTitle && candidate.originalTitle !== candidate.title) {
    parts.push(candidate.originalTitle);
  }
  if (candidate.year) parts.push(String(candidate.year));
  parts.push(typeName(candidate));
  if (candidate.genres.length > 0) parts.push(candidate.genres.join(", "));
  return parts.join(" · ");
}

function typeName(candidate: Candidate): string {
  return candidate.type === MediaType.TV ? "TV show" : "Movie";
}

// "92 % sure"; a direct IMDb or TMDB link is certain.
function confidenceText(value?: number): string {
  if (value === undefined) return "certain";
  return `${Math.round(value * 100)} % sure`;
}

// The Candidate's page on TMDB.
function tmdbUrl(candidate: Candidate): string {
  const kind = candidate.type === MediaType.TV ? "tv" : "movie";
  return `https://www.themoviedb.org/${kind}/${candidate.tmdbId}`;
}
