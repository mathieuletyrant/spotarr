import { DependencyState } from "@spotarr/contract";
import { useQuery } from "@tanstack/react-query";
import { dependenciesQuery } from "../../queries/settings";
import { DOTS } from "../services-status";

const LABELS: Record<DependencyState, string> = {
  [DependencyState.UNSPECIFIED]: "Checking…",
  [DependencyState.OK]: "Connected",
  [DependencyState.NOT_CONFIGURED]: "Not set up",
  [DependencyState.ERROR]: "Not answering",
};

// A connection card's state, the same check as the header's Services dot.
// The error itself is in the header's list.
export function ConnectionState({ name }: { name: string }) {
  const { data } = useQuery(dependenciesQuery());
  const dependency = data?.dependencies.find((d) => d.name === name);
  const state = dependency?.state ?? DependencyState.UNSPECIFIED;
  return (
    <span
      title={dependency?.detail}
      className="flex shrink-0 items-center gap-1.5 text-sm text-text-muted"
    >
      <span className={`size-2 rounded-full ${DOTS[state]}`} />
      {LABELS[state]}
    </span>
  );
}
