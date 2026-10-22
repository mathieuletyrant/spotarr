import { MediaType, RuleAction } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick } from "lucide-react";
import { ACTION_BUTTONS, actionsFor } from "../../lib/actions";
import { actionsSetUp } from "../../lib/rules";
import { settingsQuery } from "../../queries/settings";
import { type Form, Section, SelectField } from "./fields";

// The big button on a Share, by type: the same Actions as a Rule's, by hand.
// The other Actions set up show beside it, smaller.
export function ShareActionsSection({ form }: { form: Form }) {
  const { data } = useQuery(settingsQuery());
  const actions = actionsSetUp(data?.settings);
  return (
    <Section
      id="share-actions"
      icon={<MousePointerClick aria-hidden className="size-5" />}
      title="Buttons on a Share"
      description="The same Actions as a rule's, by hand: pick the big button for movies and for TV shows."
      info="The other Actions set up show beside it, smaller. An Action shows once its connection is set: Seerr's need its URL and API key, Snug's its Watchlist URL, and Snug takes TV shows only."
    >
      <SelectField
        form={form}
        name="shareActions.movie"
        label="Movies"
        options={optionsFor(actionsFor(actions, MediaType.MOVIE))}
      />
      <SelectField
        form={form}
        name="shareActions.tv"
        label="TV shows"
        options={optionsFor(actionsFor(actions, MediaType.TV))}
      />
    </Section>
  );
}

// "" is the first Action set up; the others by their name, as the setting stores them.
function optionsFor(actions: RuleAction[]) {
  const first = actions[0];
  const options = [
    {
      value: "",
      label:
        first === undefined
          ? "Nothing set up yet"
          : `${ACTION_BUTTONS[first].label} (first set up)`,
    },
  ];
  for (const action of actions) {
    options.push({ value: RuleAction[action], label: ACTION_BUTTONS[action].label });
  }
  return options;
}
