import { SpotarrError } from "../../errors";

export type SeerrConfig = { url: string; apiKey: string };

// Seerr's address is a setting, so the client Orval generates (gen/seerr.ts)
// calls this function with a path like "/movie/424", and the options each call
// passes, which carry the address and the API key. It returns what the
// generated code expects: { data, status, headers }. `alsoFine` lists error
// statuses that are an answer for this call (409: already in the watchlist).
export async function seerrFetch<T>(
  path: string,
  options: RequestInit & { seerr?: SeerrConfig; alsoFine?: number[] },
): Promise<T> {
  const { seerr, alsoFine = [], ...init } = options;
  if (!seerr?.url || !seerr.apiKey) {
    throw new SpotarrError(
      "not_configured",
      "Seerr URL or API key not configured (Settings → Seerr)",
    );
  }

  // "http://umbrel.local:5056/" and "http://umbrel.local:5056" both work.
  const res = await fetch(`${seerr.url.replace(/\/+$/, "")}/api/v1${path}`, {
    ...init,
    headers: { ...init.headers, "X-Api-Key": seerr.apiKey },
    signal: AbortSignal.timeout(10_000),
  }).catch(unreachable);

  if (res.status === 401 || res.status === 403) {
    throw new SpotarrError("unavailable", `Seerr refused the API key (${res.status})`);
  }
  if (!res.ok && !alsoFine.includes(res.status)) {
    throw new SpotarrError("unavailable", `Seerr answered ${res.status}`);
  }
  // Removing from the watchlist answers 204, with no body.
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  return { data, status: res.status, headers: res.headers } as T;
}

// fetch itself failed: no network, or the 10 s timeout ran out.
function unreachable(error: unknown): never {
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new SpotarrError("timeout", "Seerr took more than 10 s");
  }
  throw new SpotarrError("unavailable", `Seerr could not be reached: ${String(error)}`);
}
