import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Breakdown } from "../../components/stats/breakdown";
import { MonthsChart } from "../../components/stats/months-chart";
import { TopAuthors } from "../../components/stats/top-authors";
import { Totals } from "../../components/stats/totals";
import { statsQuery } from "../../queries/status";

export const Route = createFileRoute("/_app/stats")({ component: StatsPage });

function StatsPage() {
  const { data, error, isPending } = useQuery(statsQuery());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Stats</h1>
        <p className="mt-1 hidden text-text-muted sm:block">
          What Spotarr found and added since the first share.
        </p>
      </div>
      {isPending && <p className="text-text-muted">Loading…</p>}
      {error && <p className="text-status-error">{error.message}</p>}
      {data && (
        <>
          <Totals
            months={data.months}
            added={data.moviesAdded + data.showsAdded}
            recentlyAdded={data.recentlyAdded}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MonthsChart months={data.months} />
            <TopAuthors authors={data.authors} />
          </div>
          <Breakdown movies={data.moviesAdded} shows={data.showsAdded} sources={data.sources} />
        </>
      )}
    </div>
  );
}
