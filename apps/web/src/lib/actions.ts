import { MediaType, RuleAction, type Settings } from "@spotarr/contract";
import { Bookmark, type LucideIcon, Plus, Sofa } from "lucide-react";
import { actionsSetUp } from "./rules";

// How an Action reads on a Share's buttons. The same Actions as a Rule's.
export const ACTION_BUTTONS: Record<
  RuleAction,
  // label: from md up; phone: a phone's width; short: beside an icon on a candidate's line.
  { label: string; phone: string; short: string; done: string; icon: LucideIcon }
> = {
  [RuleAction.UNSPECIFIED]: {
    label: "Request in Seerr",
    phone: "Request in Seerr",
    short: "Request",
    done: "Requested",
    icon: Plus,
  },
  [RuleAction.SEERR_REQUEST]: {
    label: "Request in Seerr",
    phone: "Request in Seerr",
    short: "Request",
    done: "Requested",
    icon: Plus,
  },
  [RuleAction.SEERR_WATCHLIST]: {
    label: "Add to Seerr's watchlist",
    phone: "Add to Seerr",
    short: "Seerr",
    done: "In Seerr's watchlist",
    icon: Bookmark,
  },
  [RuleAction.SNUG_WATCHLIST]: {
    label: "Add to Snug's Watchlist",
    phone: "Add to Snug",
    short: "Snug",
    done: "In Snug's Watchlist",
    icon: Sofa,
  },
};

// The Actions that can take a title of this type: Snug tracks TV shows only.
export function actionsFor(actions: RuleAction[], type: MediaType): RuleAction[] {
  return actions.filter((action) => action !== RuleAction.SNUG_WATCHLIST || type === MediaType.TV);
}

// The buttons of a Share's candidate, main one first: the Actions set up for
// its type, led by the one chosen in Settings → Automation, else the first.
export function shareActions(settings: Settings | undefined, type: MediaType): RuleAction[] {
  const actions = actionsFor(actionsSetUp(settings), type);
  const chosen = type === MediaType.TV ? settings?.shareActions?.tv : settings?.shareActions?.movie;
  const main = actions.find((action) => RuleAction[action] === chosen);
  if (main === undefined) return actions;
  return [main, ...actions.filter((action) => action !== main)];
}
