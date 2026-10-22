import { SpotarrError } from "../../errors";

export type SnugConfig = { watchlistUrl: string };

// What Snug answers: the series' status there, and whether this call added it
// (false: Snug already tracked it, and kept its status).
export type SnugAnswer = { status: string; added: boolean };

// Puts a TV show on Snug's Watchlist. The URL carries Snug's token, so it is
// never logged.
export async function addToSnugWatchlist(config: SnugConfig, tmdbId: number): Promise<SnugAnswer> {
  const res = await fetch(config.watchlistUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tmdbId }),
    signal: AbortSignal.timeout(10_000),
  }).catch(unreachable);

  if (res.status === 404) {
    throw new SpotarrError(
      "unavailable",
      "Snug does not know this Watchlist URL: copy it again from Snug",
    );
  }
  if (!res.ok) throw new SpotarrError("unavailable", `Snug answered ${res.status}`);
  return (await res.json()) as SnugAnswer;
}

// fetch itself failed: no network, or the 10 s timeout ran out.
function unreachable(error: unknown): never {
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new SpotarrError("timeout", "Snug took more than 10 s");
  }
  throw new SpotarrError("unavailable", `Snug could not be reached: ${String(error)}`);
}
