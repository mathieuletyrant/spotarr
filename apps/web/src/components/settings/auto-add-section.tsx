import { Zap } from "lucide-react";
import { Section } from "./fields";
import { RulesList } from "./rules-list";

// Rules are saved one by one, by their own cards: nothing here goes through
// the Settings form.
export function AutoAddSection() {
  return (
    <Section
      id="auto-add"
      icon={<Zap aria-hidden className="size-5" />}
      title="Auto add"
      description="Rules that request a candidate without a click."
      info="A candidate is requested through Seerr when one enabled rule holds for it, and credited to the first one. A title already in the library is never requested again; a TV show gets season 1."
    >
      <RulesList />
    </Section>
  );
}
