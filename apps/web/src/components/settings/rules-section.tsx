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
      description="Act on candidates automatically when an identification ends."
      info="A request wins over a watchlist when both match. A title already in the library is never requested again. TV shows get season 1."
    >
      <RulesList />
    </Section>
  );
}
