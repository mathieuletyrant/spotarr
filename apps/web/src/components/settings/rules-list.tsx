import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { actionsSetUp } from "../../lib/rules";
import { rulesQuery, settingsQuery } from "../../queries/settings";
import { RuleCard } from "./rule-card";

// The Rules, oldest first, then a new one being written, or the button to
// write one. A Rule needs an Action: without a connection set up, none.
export function RulesList() {
  const { data } = useQuery(rulesQuery());
  const settings = useQuery(settingsQuery());
  const [adding, setAdding] = useState(false);
  const rules = data?.rules ?? [];
  const canAct = actionsSetUp(settings.data?.settings).length > 0;

  return (
    <div className="flex flex-col gap-3 md:col-span-2">
      {!canAct && (
        <p className="text-sm text-text-muted">
          Set up Seerr in{" "}
          <Link
            to="/settings"
            search={{ section: "connections" }}
            className="font-medium text-text underline"
          >
            Connections
          </Link>{" "}
          first.
        </p>
      )}
      {canAct && rules.length === 0 && !adding && (
        <p className="text-sm text-text-muted">No rule yet: you pick every candidate yourself.</p>
      )}
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}
      {adding && <RuleCard onDone={() => setAdding(false)} />}
      {canAct && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 w-fit items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
        >
          <Plus aria-hidden className="size-4" />
          Add a rule
        </button>
      )}
    </div>
  );
}
