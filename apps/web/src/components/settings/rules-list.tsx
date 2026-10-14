import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { rulesQuery } from "../../queries/settings";
import { RuleCard } from "./rule-card";

// Auto add's Rules, oldest first, then a new one being written, or the button
// to write one.
export function RulesList() {
  const { data } = useQuery(rulesQuery());
  const [adding, setAdding] = useState(false);
  const rules = data?.rules ?? [];

  return (
    <div className="flex flex-col gap-3 md:col-span-2">
      {rules.length === 0 && !adding && (
        <p className="text-sm text-text-muted">
          No rule yet: you choose every candidate yourself, in the History.
        </p>
      )}
      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} />
      ))}
      {adding ? (
        <RuleCard onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 w-fit items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
        >
          <Plus aria-hidden className="size-4" />
          Add a rule
        </button>
      )}
      <p className="text-sm text-text-muted">
        A candidate is requested through Seerr when one enabled rule holds for it, and credited to
        the first one. A title already in the library is never requested again; a TV show gets
        season 1.
      </p>
    </div>
  );
}
