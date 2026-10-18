import { Zap } from "lucide-react";
import { Section } from "./fields";
import { RulesList } from "./rules-list";

// Rules are saved one by one, by their own cards: nothing here goes through
// the Settings form.
export function RulesSection() {
  return (
    <Section
      id="rules"
      icon={<Zap aria-hidden className="size-5" />}
      title="Rules"
      description="When an Identification ends, under these conditions, do this Action, without a click."
      info="A candidate gets an Action when one enabled rule holds for it, and is credited to the first one; a rule that requests wins over one that adds to the watchlist. A title already in the library is never requested again; a TV show gets season 1."
    >
      <RulesList />
    </Section>
  );
}
