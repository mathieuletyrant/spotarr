import { SpotarrError } from "../../errors";

export type JellyfinConfig = { url: string; apiKey: string };

// Jellyfin's address is a setting, so the client Orval generates
// (gen/jellyfin.ts) calls this function with a path like "/Items?…", and the
// options each call passes, which carry the address and the API key. It
// returns what the generated code expects: { data, status, headers }.
export async function jellyfinFetch<T>(
  path: string,
  options: RequestInit & { jellyfin?: JellyfinConfig },
): Promise<T> {
  const { jellyfin, ...init } = options;
  if (!jellyfin?.url || !jellyfin.apiKey) {
    throw new SpotarrError(
      "not_configured",
      "Jellyfin URL or API key not configured (Settings → Jellyfin)",
    );
  }

  // The header Jellyfin documents for an API key. X-Emby-Token works too, but
  // Jellyfin can turn the legacy headers off.
  const authorization = `MediaBrowser Token="${jellyfin.apiKey}"`;
  // Listing a whole library takes a few seconds on a large one: 30 s.
  const res = await fetch(`${jellyfin.url.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: authorization },
    signal: AbortSignal.timeout(30_000),
  }).catch(unreachable);

  if (res.status === 401 || res.status === 403) {
    throw new SpotarrError("unavailable", `Jellyfin refused the API key (${res.status})`);
  }
  if (!res.ok) throw new SpotarrError("unavailable", `Jellyfin answered ${res.status}`);
  // Adding to or removing from a collection answers 204, with no body.
  const data = res.status === 204 ? undefined : await res.json();
  return { data, status: res.status, headers: res.headers } as T;
}

// fetch itself failed: no network, or the 30 s timeout ran out.
function unreachable(error: unknown): never {
  if (error instanceof Error && error.name === "TimeoutError") {
    throw new SpotarrError("timeout", "Jellyfin took more than 30 s");
  }
  throw new SpotarrError("unavailable", `Jellyfin could not be reached: ${String(error)}`);
}
