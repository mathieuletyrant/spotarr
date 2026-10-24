import { timestampDate } from "@bufbuild/protobuf/wkt";
import { type Candidate, MediaType, Method, type Share, Summary, Target } from "@spotarr/contract";
import { Link } from "@tanstack/react-router";
import { seconds, shareDate } from "../../lib/format";
import { Poster } from "../poster";
import { SourceIcon } from "../source-icon";
import { StatusBadge } from "../status-badge";
import { TmdbRating } from "../tmdb-rating";
import { HISTORY_COLUMNS } from "./columns";

// One Share of the history: a compact card on a phone or a tablet, a row of
// six columns from lg on. Either way, it links to the Share's page.
export function ShareRow({ share }: { share: Share }) {
  return (
    <li>
      <ShareCard share={share} />
      <Link
        to="/shares/$shareId"
        params={{ shareId: share.id }}
        className={`hidden px-4 py-4 hover:bg-text/4 lg:items-center ${HISTORY_COLUMNS}`}
      >
        <ShareDate share={share} />
        <SharedContent share={share} />
        <Result share={share} />
        <span className="text-sm">{targetOf(share)}</span>
        <Status share={share} />
        <span className="text-sm text-text-muted">{methodOf(share)}</span>
      </Link>
    </li>
  );
}

// On a phone or a tablet: the poster, then what was found, where and when it came from,
// and the status. Three lines beside a medium poster on a phone, so a screen
// holds twice as many Shares; the genres come back from sm on.
function ShareCard({ share }: { share: Share }) {
  const { day, time } = shareDate(share.createdAt ? timestampDate(share.createdAt) : new Date());
  const [first] = share.candidates;
  return (
    <Link
      to="/shares/$shareId"
      params={{ shareId: share.id }}
      className="flex gap-3 px-3 py-2.5 hover:bg-text/4 lg:hidden"
    >
      {first ? (
        <Poster title={first.title} url={first.posterUrl} />
      ) : (
        <div
          aria-hidden
          className="h-21 w-14 shrink-0 rounded-md border border-dashed border-border"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <p className="truncate">
          <CardTitle share={share} />
        </p>
        <p className="truncate text-sm text-text-muted">
          {share.source} · {day} {time}
        </p>
        {first && share.candidates.length === 1 && first.genres.length > 0 && (
          <p className="hidden truncate text-xs text-text-muted sm:block">
            {first.genres.join(" · ")}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Status share={share} />
          {/* Outside the title, whose line is cut short on a phone. */}
          {first && share.candidates.length === 1 && (
            <TmdbRating rating={first.tmdbRating} votes={first.tmdbVotes} compact />
          )}
        </div>
      </div>
    </Link>
  );
}

function CardTitle({ share }: { share: Share }) {
  const [first, ...others] = share.candidates;
  if (share.summary === Summary.IN_PROGRESS) {
    return <span className="text-text-muted">Identifying…</span>;
  }
  if (!first) return <span className="text-text-muted">No candidates</span>;
  if (others.length > 0) {
    return (
      <span className="font-semibold">
        {first.title} <span className="font-normal text-text-muted">+{others.length} more</span>
      </span>
    );
  }
  return (
    <>
      <span className="font-semibold">{first.title}</span>{" "}
      <span className="text-text-muted">{first.year}</span>
    </>
  );
}

function ShareDate({ share }: { share: Share }) {
  const { day, time } = shareDate(share.createdAt ? timestampDate(share.createdAt) : new Date());
  return (
    <span className="text-sm">
      {day} <span className="text-text-muted lg:block">{time}</span>
    </span>
  );
}

// The source, and what came with it: the video's caption, or the text.
function SharedContent({ share }: { share: Share }) {
  const said = share.identification?.clues?.caption ?? share.input?.text;
  return (
    <div className="flex min-w-0 gap-2">
      <SourceIcon share={share} />
      <div className="min-w-0">
        <p className="truncate font-mono text-sm">{share.source}</p>
        {said && <p className="truncate text-sm text-text-muted">“{said}”</p>}
      </div>
    </div>
  );
}

function Result({ share }: { share: Share }) {
  if (share.summary === Summary.IN_PROGRESS) {
    return (
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-21 w-14 shrink-0 rounded-md border border-dashed border-border"
        />
        <span className="text-text-muted">Identifying…</span>
      </div>
    );
  }

  const [first, ...others] = share.candidates;
  if (!first) return <span className="text-text-muted">No candidates</span>;
  if (others.length === 0) return <OneCandidate candidate={first} />;

  const added = share.addedCount;
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3">
        {share.candidates.slice(0, 3).map((c) => (
          <Poster key={c.tmdbId} title={c.title} url={c.posterUrl} size="small" />
        ))}
      </div>
      <span className="text-text-muted">
        {share.candidates.length} candidates, {added === 0 ? "nothing added" : `${added} added`}
      </span>
    </div>
  );
}

function OneCandidate({ candidate }: { candidate: Candidate }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Poster title={candidate.title} url={candidate.posterUrl} />
      <div className="min-w-0">
        <p className="truncate">
          <span className="font-semibold">{candidate.title}</span>{" "}
          <span className="text-text-muted">{candidate.year}</span>
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-sm border border-border px-1.5 text-xs text-text-muted">
            {candidate.type === MediaType.TV ? "TV show" : "Movie"}
          </span>
          <TmdbRating rating={candidate.tmdbRating} votes={candidate.tmdbVotes} compact />
        </div>
        {candidate.genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-text-muted">{candidate.genres.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}

// The badge, with "1/3" when several Candidates were found, and the reason of a failure.
function Status({ share }: { share: Share }) {
  const several = share.candidates.length > 1 && share.additions.length > 0;
  const reason = share.failureReason;
  return (
    <div className="min-w-0">
      <StatusBadge
        summary={share.summary}
        detail={several ? `${share.addedCount}/${share.candidates.length}` : undefined}
      />
      {reason && <p className="mt-1 line-clamp-2 text-xs text-status-error">{reason}</p>}
    </div>
  );
}

function targetOf(share: Share): string {
  const target = share.additions.at(-1)?.target;
  if (target === Target.SEERR) return "Seerr";
  if (target === Target.ARR) return "Radarr / Sonarr";
  return "—";
}

// "LLM · 14 s" or "ID · 2 s" once the Identification is over; only the
// duration when it failed before choosing a method.
function methodOf(share: Share): string {
  const identification = share.identification;
  if (share.summary === Summary.IN_PROGRESS || !identification?.durationMs) return "—";
  const duration = seconds(identification.durationMs);
  if (identification.method === Method.DIRECT_ID) return `ID · ${duration}`;
  if (identification.method === Method.LLM) return `LLM · ${duration}`;
  return duration;
}
