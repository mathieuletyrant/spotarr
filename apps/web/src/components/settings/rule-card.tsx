import { create } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { createQueryOptions, useMutation } from "@connectrpc/connect-query";
import { MediaType, type Rule, RuleAction, RuleSchema, SpotarrService } from "@spotarr/contract";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Fragment, useDeferredValue, useId, useState } from "react";
import { transport } from "../../lib/api";
import { actionsSetUp, conditionsOf } from "../../lib/rules";
import { rulesQuery, settingsQuery } from "../../queries/settings";
import { Poster } from "../poster";
import { inputClass } from "./fields";

// What each Action reads as in the form.
const ACTION_LABELS: Record<RuleAction, string> = {
  [RuleAction.UNSPECIFIED]: "Add to the library (request it in Seerr)",
  [RuleAction.SEERR_REQUEST]: "Add to the library (request it in Seerr)",
  [RuleAction.SEERR_WATCHLIST]: "Add to Seerr's watchlist (nothing is downloaded)",
};

const buttonClass = "h-9 rounded-md border border-border px-3 text-sm font-medium";

// The form keeps numbers as text: an empty field is no condition.
type Draft = {
  name: string;
  enabled: boolean;
  action: RuleAction;
  type: MediaType;
  onlyOne: boolean;
  minConfidence: string;
  minRating: string;
  minVotes: string;
  unreleasedSkipsRating: boolean;
};

function draftOf(rule?: Rule): Draft {
  return {
    name: rule?.name ?? "",
    enabled: rule?.enabled ?? true,
    action: rule?.action ?? RuleAction.SEERR_REQUEST,
    type: rule?.type ?? MediaType.UNSPECIFIED,
    onlyOne: rule?.onlyOne ?? false,
    minConfidence: rule?.minConfidence?.toString() ?? "",
    minRating: rule?.minRating?.toString() ?? "",
    minVotes: rule?.minVotes?.toString() ?? "",
    unreleasedSkipsRating: rule?.unreleasedSkipsRating ?? false,
  };
}

function ruleOf(draft: Draft, id = ""): Rule {
  return create(RuleSchema, {
    id,
    name: draft.name,
    enabled: draft.enabled,
    action: draft.action,
    type: draft.type,
    onlyOne: draft.onlyOne,
    minConfidence: numberOf(draft.minConfidence),
    minRating: numberOf(draft.minRating),
    minVotes: numberOf(draft.minVotes),
    unreleasedSkipsRating: draft.unreleasedSkipsRating,
  });
}

function numberOf(text: string): number | undefined {
  if (text.trim() === "") return undefined;
  return Number(text);
}

// One Rule: read as a sentence with its switch, or edited in place with a
// preview of what it would have added. Without `rule`, a new one, edited.
export function RuleCard({ rule, onDone }: { rule?: Rule; onDone?: () => void }) {
  const [editing, setEditing] = useState(!rule);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: rulesQuery().queryKey });
  const toggle = useMutation(SpotarrService.method.saveRule, { onSuccess: refresh });

  if (editing || !rule) {
    return (
      <RuleForm
        rule={rule}
        onDone={() => {
          setEditing(false);
          onDone?.();
        }}
      />
    );
  }

  // The whole card opens the form: an invisible button covers it, under the
  // switch, which sits above it to stay clickable on its own.
  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-border bg-surface p-4 hover:border-text/30">
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${rule.name}`}
        className="absolute inset-0 rounded-lg"
      />
      {/* A rule switched off fades, so the ones at work stand out. */}
      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${rule.enabled ? "" : "opacity-50"}`}>
        <p className="truncate leading-7 font-medium">{rule.name}</p>
        <RuleSentence rule={rule} />
        {toggle.error && <p className="text-sm text-status-error">{toggle.error.rawMessage}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={rule.enabled}
        aria-label={`${rule.name}: ${rule.enabled ? "on" : "off"}`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ rule: { ...rule, enabled: !rule.enabled } })}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-text/15 transition-colors aria-checked:bg-accent"
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-bg shadow transition-transform ${rule.enabled ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

// What a Rule does, as its sentence ends. UNSPECIFIED is how an older Rule
// reads: it requests.
function actionText(action: RuleAction): string {
  if (action === RuleAction.SEERR_WATCHLIST) return "add to Seerr's watchlist";
  return "add to the library";
}

// "If a movie and a single candidate → add to the library", the conditions as
// chips: all of them must hold.
function RuleSentence({ rule }: { rule: Rule }) {
  const conditions = conditionsOf(rule);
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="text-text-muted">If</span>
      {conditions.length === 0 && (
        <span className="rounded-md bg-status-error/10 px-2 py-0.5 text-xs font-medium text-status-error">
          any candidate
        </span>
      )}
      {conditions.map((condition, index) => (
        <Fragment key={condition}>
          {index > 0 && <span className="text-text-muted">and</span>}
          <span className="rounded-md bg-text/8 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
            {condition}
          </span>
        </Fragment>
      ))}
      <ArrowRight aria-hidden className="size-3.5 text-text-muted" />
      <span className="text-text-muted">{actionText(rule.action)}</span>
    </p>
  );
}

function RuleForm({ rule, onDone }: { rule?: Rule; onDone: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(draftOf(rule));
  const change = (fields: Partial<Draft>) => setDraft({ ...draft, ...fields });
  const asksRating = draft.minRating.trim() !== "" || draft.minVotes.trim() !== "";
  const settings = useQuery(settingsQuery());
  // The Actions of the connections set up, and the Rule's own even when its
  // connection was removed since: it is shown as it is.
  const current = draft.action === RuleAction.UNSPECIFIED ? RuleAction.SEERR_REQUEST : draft.action;
  const offered = actionsSetUp(settings.data?.settings);
  const actions = offered.includes(current) ? offered : [current, ...offered];

  const refresh = () => queryClient.invalidateQueries({ queryKey: rulesQuery().queryKey });
  const save = useMutation(SpotarrService.method.saveRule, {
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const remove = useMutation(SpotarrService.method.deleteRule, { onSuccess: refresh });
  const error = save.error ?? remove.error;

  // The preview follows the form a moment after the keystrokes, and keeps the
  // last answer on screen while the next one comes.
  const tried = useDeferredValue(ruleOf({ ...draft, enabled: true }, rule?.id));
  const preview = useQuery({
    ...createQueryOptions(SpotarrService.method.previewRules, { rules: [tried] }, { transport }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4 rounded-md border border-accent/50 p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label htmlFor={`${id}-name`} className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">Name</span>
          <input
            id={`${id}-name`}
            value={draft.name}
            onChange={(e) => change({ name: e.target.value })}
            placeholder="Safe movies"
            maxLength={60}
            className={inputClass}
          />
        </label>
        <label htmlFor={`${id}-action`} className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">Then</span>
          <select
            id={`${id}-action`}
            value={current}
            onChange={(e) => change({ action: Number(e.target.value) as RuleAction })}
            className={inputClass}
          >
            {actions.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
          <span className="text-sm text-text-muted">
            A candidate both kinds of rules hold for is added to the library. The watchlist shows in
            JellyTV, and a title leaves it once available.
          </span>
        </label>
        <label htmlFor={`${id}-type`} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Type</span>
          <select
            id={`${id}-type`}
            value={draft.type}
            onChange={(e) => change({ type: Number(e.target.value) as MediaType })}
            className={inputClass}
          >
            <option value={MediaType.UNSPECIFIED}>Movies and TV shows</option>
            <option value={MediaType.MOVIE}>Movies only</option>
            <option value={MediaType.TV}>TV shows only</option>
          </select>
        </label>
        <label htmlFor={`${id}-confidence`} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Confidence at least (%)</span>
          <input
            id={`${id}-confidence`}
            type="number"
            min={1}
            max={100}
            value={draft.minConfidence}
            onChange={(e) => change({ minConfidence: e.target.value })}
            placeholder="Any"
            className={inputClass}
          />
        </label>
        <label htmlFor={`${id}-rating`} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">TMDB rating at least</span>
          <input
            id={`${id}-rating`}
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={draft.minRating}
            onChange={(e) => change({ minRating: e.target.value })}
            placeholder="Any"
            className={inputClass}
          />
        </label>
        <label htmlFor={`${id}-votes`} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">With at least (votes)</span>
          <input
            id={`${id}-votes`}
            type="number"
            min={0}
            value={draft.minVotes}
            onChange={(e) => change({ minVotes: e.target.value })}
            placeholder="Any"
            className={inputClass}
          />
          <span className="text-sm text-text-muted">
            A new release with 3 votes at 9/10 says little.
          </span>
        </label>
        <label
          className={`flex items-start gap-2 text-sm md:col-span-2 ${asksRating ? "" : "text-text-muted"}`}
        >
          <input
            type="checkbox"
            checked={draft.unreleasedSkipsRating}
            disabled={!asksRating}
            onChange={(e) => change({ unreleasedSkipsRating: e.target.checked })}
            className="mt-0.5 accent-accent"
          />
          <span>
            Titles not out yet skip the rating
            <span className="block text-text-muted">
              Nobody has rated them: the other conditions still apply.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={draft.onlyOne}
            onChange={(e) => change({ onlyOne: e.target.checked })}
            className="accent-accent"
          />
          Only when the identification finds a single candidate
        </label>
      </div>

      <RuleSentence rule={ruleOf(draft)} />
      <Preview
        action={draft.action}
        shares={preview.data?.shares}
        additions={preview.data?.additions ?? []}
        error={preview.error ? ConnectError.from(preview.error).rawMessage : undefined}
      />
      {error && <p className="text-sm text-status-error">{error.rawMessage}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate({ rule: ruleOf(draft, rule?.id) })}
          className={`${buttonClass} border-accent bg-accent text-accent-text`}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass}>
          Cancel
        </button>
        {rule && (
          <button
            type="button"
            onClick={() => remove.mutate({ id: rule.id })}
            className={`${buttonClass} ml-auto text-status-error`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// How many titles the Rule would have added over the latest Shares, and the
// first of them, posters first, each opening the Share it came from.
const PREVIEWED = 6;

function Preview(props: {
  action: RuleAction;
  shares?: number;
  additions: { shareId: string; title: string; year?: number; posterUrl?: string }[];
  error?: string;
}) {
  if (props.error) return <p className="text-sm text-status-error">{props.error}</p>;
  if (props.shares === undefined) return null;
  const count = props.additions.length;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-surface p-3">
      <p className="text-sm">
        Over your last {props.shares} identified shares, this rule would have{" "}
        {props.action === RuleAction.SEERR_WATCHLIST ? "put " : "added "}
        <span className="font-semibold">
          {count} {count === 1 ? "title" : "titles"}
        </span>
        {props.action === RuleAction.SEERR_WATCHLIST ? " in the watchlist." : "."}
      </p>
      {count > 0 && (
        <ul className="flex flex-wrap gap-3">
          {props.additions.slice(0, PREVIEWED).map((a) => (
            <li key={`${a.shareId}-${a.title}`} className="w-14">
              {/* A new tab, so the Rule being edited is not lost. */}
              <Link
                to="/shares/$shareId"
                params={{ shareId: a.shareId }}
                target="_blank"
                title={a.title}
                className="group flex flex-col gap-1 rounded-md"
              >
                <Poster title={a.title} url={a.posterUrl} />
                <span className="truncate text-xs text-text-muted group-hover:text-text group-hover:underline">
                  {a.title}
                </span>
                <span className="sr-only">(opens its share in a new tab)</span>
              </Link>
            </li>
          ))}
          {count > PREVIEWED && (
            <li className="flex h-21 items-center text-sm text-text-muted">+{count - PREVIEWED}</li>
          )}
        </ul>
      )}
    </div>
  );
}
