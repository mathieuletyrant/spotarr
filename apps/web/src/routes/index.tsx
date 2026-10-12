import { useQuery } from "@connectrpc/connect-query";
import { SpotarrService, Summary } from "@spotarr/contract";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: History });

// First version: the shares, one per line. The real page comes with #45.
function History() {
  const { data, isPending, error } = useQuery(SpotarrService.method.listShares, {});

  if (isPending) return <p className="text-text-muted">Chargement…</p>;
  if (error) return <p className="text-status-error">{error.message}</p>;
  if (data.shares.length === 0)
    return <p className="text-text-muted">Aucun partage pour l'instant.</p>;

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {data.shares.map((share) => (
        <li key={share.id} className="flex justify-between px-4 py-3">
          <span>{share.source}</span>
          <span className="text-text-muted">{Summary[share.summary]}</span>
        </li>
      ))}
    </ul>
  );
}
