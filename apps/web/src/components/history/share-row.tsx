import { timestampDate } from "@bufbuild/protobuf/wkt";
import {
  AdditionStatus,
  type Candidate,
  MediaType,
  Method,
  type Share,
  Summary,
  Target,
} from "@spotarr/contract";
import { seconds, shareDate } from "../../lib/format";
import { Poster } from "../poster";
import { SourceIcon } from "../source-icon";
import { StatusBadge } from "../status-badge";
import { HISTORY_COLUMNS } from "./columns";

// Additions that put the work in the library, or found it there already.
const SUCCESSES = [AdditionStatus.ADDED, AdditionStatus.REQUESTED, AdditionStatus.ALREADY_PRESENT];

// One Share of the history: a row of six columns on a wide screen, a card on a phone.
export function ShareRow({ share }: { share: Share }) {
  return (
    <li className={`grid gap-3 px-4 py-4 md:items-center ${HISTORY_COLUMNS}`}>
      <ShareDate share={share} />
      <SharedContent share={share} />
      <Result share={share} />
      <span className="hidden text-sm md:block">{targetOf(share)}</span>
      {/* On a phone, status and method share one line; from md on, `contents`
          makes them two cells of the row's grid again. */}
      <div className="flex items-center justify-between gap-3 md:contents">
        <Status share={share} />
        <span className="text-sm text-text-muted">{methodOf(share)}</span>
      </div>
    </li>
  );
}

function ShareDate({ share }: { share: Share }) {
  const { day, time } = shareDate(share.createdAt ? timestampDate(share.createdAt) : new Date());
  return (
    <span className="text-sm">
      {day} <span className="text-text-muted md:block">{time}</span>
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

  const added = share.additions.filter((a) => SUCCESSES.includes(a.status)).length;
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3">
        {share.candidates.slice(0, 3).map((c) => (
          <Poster key={c.tmdbId} title={c.title} url={c.posterUrl} small />
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
        <span className="mt-1 inline-block rounded-sm border border-border px-1.5 text-xs text-text-muted">
          {candidate.type === MediaType.TV ? "TV show" : "Movie"}
        </span>
      </div>
    </div>
  );
}

// The badge, with "1/3" when several Candidates were found, and the reason of a failure.
function Status({ share }: { share: Share }) {
  const several = share.candidates.length > 1 && share.additions.length > 0;
  const added = share.additions.filter((a) => SUCCESSES.includes(a.status)).length;
  const reason =
    share.summary === Summary.FAILED
      ? (share.additions.at(-1)?.error ?? share.identification?.error)
      : undefined;
  return (
    <div className="min-w-0">
      <StatusBadge
        summary={share.summary}
        detail={several ? `${added}/${share.candidates.length}` : undefined}
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
