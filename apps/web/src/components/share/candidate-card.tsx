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
import { Link } from "@tanstack/react-router";
import { BookmarkCheck, ChevronDown, Play } from "lucide-react";
import { ACTION_BUTTONS, shareActions } from "../../lib/actions";
import { settingsQuery } from "../../queries/settings";
import { watchLinksQuery } from "../../queries/shares";
import { Keywords } from "../keywords";
import { Poster } from "../poster";
import { StatusBadge } from "../status-badge";
import { TmdbRating } from "../tmdb-rating";

// The Candidates of a Share. The first, the most likely (the Identification
// sorts them by confidence), takes the stage with one big action: watch it
// where it already is, else the Actions set up, the same as a Rule's. The
// others get one line each.
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
      <Keywords keywords={candidate.keywords} />
    </div>
  );
}

// Watch it where it already is, else the main Action (Settings → Automation),
// the others in a menu beside it. When it can be watched, every Action waits in
// a quieter "Other actions" menu.
function BestMatchActions({
  share,
  candidate,
  links,
}: {
  share: Share;
  candidate: Candidate;
  links: WatchLink[];
}) {
  const actions = useShareActions(candidate);
  const [main, ...others] = actions;
  const [first, ...more] = links;
  const canAdd = candidate.status === CandidateStatus.CAN_ADD;

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
        {canAdd && !first && main !== undefined && (
          <div className="flex">
            <ActionButton
              share={share}
              candidate={candidate}
              action={main}
              look="main"
              joined={others.length > 0}
            />
            {others.length > 0 && (
              <ActionsMenu share={share} candidate={candidate} actions={others} trigger="joined" />
            )}
          </div>
        )}
        {canAdd && actions.length === 0 && <NothingSetUp />}
        {!canAdd && <Status candidate={candidate} />}
      </div>
      {canAdd && first && actions.length > 0 && (
        <div className="self-center md:self-start">
          <ActionsMenu share={share} candidate={candidate} actions={actions} trigger="text" />
        </div>
      )}
      {candidate.failure && <p className="text-sm text-status-error">{candidate.failure}</p>}
    </div>
  );
}

const BUTTON_LOOKS = {
  main: "flex h-10 items-center gap-1.5 rounded-md whitespace-nowrap bg-accent px-4 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent",
  secondary:
    "flex h-10 items-center gap-1.5 rounded-md border border-border px-4 whitespace-nowrap text-sm font-medium hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent",
  link: "text-sm text-text-muted underline hover:text-text",
  small:
    "flex h-9 items-center gap-1 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent",
  smallMain:
    "flex h-9 items-center gap-1 rounded-md bg-accent px-2.5 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent",
  item: "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent",
};

// One Action on one Candidate: its button, then what it did. A request shows in
// the Candidate's status; a watchlist keeps no trace, so "In …" shows only until
// the page reloads. A small look is an icon alone on a phone, a word beside it
// from md up.
function ActionButton({
  share,
  candidate,
  action,
  look,
  joined = false,
}: {
  share: Share;
  candidate: Candidate;
  action: RuleAction;
  look: keyof typeof BUTTON_LOOKS;
  // Its right side is the menu's ▾: no rounded corners there.
  joined?: boolean;
}) {
  const add = useAdd(share, candidate, action);
  const button = ACTION_BUTTONS[action];
  const Icon = button.icon;
  const small = look === "small" || look === "smallMain";

  if (add.isDone && action !== RuleAction.SEERR_REQUEST) {
    return (
      <span title={button.done} className="flex items-center gap-1.5 text-sm text-text-muted">
        <BookmarkCheck aria-hidden className="size-4" />
        <span className={small ? "sr-only" : ""}>{button.done}</span>
      </span>
    );
  }
  let text = small ? button.short : button.label;
  // A phone has room for the short "Add to Snug", not "Add to Snug's Watchlist";
  // a menu has room for the whole label.
  let phoneText = button.phone;
  if (small) phoneText = button.short;
  if (look === "item") phoneText = button.label;
  if (add.isPending) {
    text = "Adding…";
    phoneText = text;
  } else if (add.error) {
    text = "Try again";
    phoneText = text;
  }
  return (
    <>
      <button
        type="button"
        onClick={add.start}
        disabled={add.isPending}
        title={add.error?.message ?? button.label}
        className={joined ? `${BUTTON_LOOKS[look]} rounded-r-none` : BUTTON_LOOKS[look]}
      >
        {look !== "link" && <Icon aria-hidden className="size-4" />}
        {small && <span className="sr-only md:not-sr-only">{text}</span>}
        {!small && <span className="md:hidden">{phoneText}</span>}
        {!small && <span className="hidden md:inline">{text}</span>}
        {small && <span className="sr-only"> ({button.label})</span>}
      </button>
      {add.error && !small && (
        <p className="basis-full text-sm text-status-error">{add.error.message}</p>
      )}
    </>
  );
}

const MENU_TRIGGERS = {
  // Glued to the main button's right side.
  joined:
    "flex h-10 items-center rounded-r-md border-l border-accent-text/20 bg-accent px-2 text-accent-text focus-visible:outline-2 focus-visible:outline-accent",
  small:
    "flex h-9 items-center rounded-md border border-border px-1.5 hover:bg-text/8 focus-visible:outline-2 focus-visible:outline-accent",
  text: "flex items-center gap-1 text-sm text-text-muted underline hover:text-text",
};

// Actions in a menu under a ▾: the page keeps one clear button, every Action
// stays one tap away. A native popover, placed under its trigger like the
// Services one (inset-auto undoes a popover's default inset: 0, which pins it
// left); it flips above when there is no room below.
function ActionsMenu({
  share,
  candidate,
  actions,
  trigger,
}: {
  share: Share;
  candidate: Candidate;
  actions: RuleAction[];
  trigger: keyof typeof MENU_TRIGGERS;
}) {
  const id = `actions-${MediaType[candidate.type]}-${candidate.tmdbId}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={trigger === "text" ? undefined : "Other actions"}
        style={{ anchorName: `--${id}` }}
        className={MENU_TRIGGERS[trigger]}
      >
        {trigger === "text" && "Other actions"}
        <ChevronDown aria-hidden className="size-4" />
      </button>
      <div
        id={id}
        popover="auto"
        style={{ positionAnchor: `--${id}` }}
        className="inset-auto m-0 mt-1 w-max min-w-52 rounded-xl border border-border bg-surface-raised p-1 text-text shadow-lg [position-try-fallbacks:flip-block] [right:anchor(right)] [top:anchor(bottom)]"
      >
        {actions.map((action) => (
          <ActionButton
            key={action}
            share={share}
            candidate={candidate}
            action={action}
            look="item"
          />
        ))}
      </div>
    </>
  );
}

// No Action set up yet: say where to set one.
function NothingSetUp() {
  return (
    <Link
      to="/settings"
      search={{ section: "connections" }}
      className="text-sm text-text-muted underline"
    >
      Connect Seerr or Snug to add it
    </Link>
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

// The main Action, an icon alone on a phone and a word beside it from md up,
// then the others in a menu.
function SmallAction({ share, candidate }: { share: Share; candidate: Candidate }) {
  const actions = useShareActions(candidate);
  const [main, ...others] = actions;
  if (candidate.status !== CandidateStatus.CAN_ADD) return <Status candidate={candidate} />;
  if (main === undefined) return null;
  return (
    <div className="flex gap-1.5">
      <ActionButton share={share} candidate={candidate} action={main} look="smallMain" />
      {others.length > 0 && (
        <ActionsMenu share={share} candidate={candidate} actions={others} trigger="small" />
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

// The buttons of this Candidate: the Actions set up for its type, main first.
function useShareActions(candidate: Candidate): RuleAction[] {
  const { data } = useQuery(settingsQuery());
  return shareActions(data?.settings, candidate.type);
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
