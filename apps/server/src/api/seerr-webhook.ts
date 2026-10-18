import type { Handler } from "hono";
import { z } from "zod";
import type { SettingsRepository } from "../domain/settings/repository";
import type { ShareRepository } from "../domain/shares/repository";
import { updateLibraryState } from "../domain/shares/use-cases/update-library-state";
import { unwatchTitle } from "../domain/watchlist/use-cases/unwatch-title";
import { log } from "../log";

// The JSON payload the Settings page tells Mathieu to paste into Seerr's
// Webhook agent (components/settings/seerr-webhook-fields.tsx). Seerr fills
// each {{…}} as a string: "movie" or "tv", and the TMDB id.
const TitleChanged = z.object({
  type: z.enum(["movie", "tv"]),
  tmdbId: z.coerce.number().int().positive(),
});

// POST /seerr/webhook: Seerr says a title changed in the library. Behind the
// Seerr token. A payload naming no title (Seerr's Test button, or an issue
// notification) answers 200 too, so Seerr shows the test as passed. A title
// now in the library leaves the watchlist, without Seerr waiting for it.
export function seerrWebhook(shares: ShareRepository, settings: SettingsRepository): Handler {
  return async (c) => {
    const title = TitleChanged.safeParse(await c.req.json().catch(() => undefined));
    if (!title.success) return c.json({ ok: true, updated: false });

    const type = title.data.type === "movie" ? "MOVIE" : "TV";
    const state = await updateLibraryState(type, title.data.tmdbId, { shares, settings });
    if (state === "AVAILABLE" || state === "PARTIAL") {
      unwatchTitle(type, title.data.tmdbId, settings).catch((error) =>
        log({ step: "watchlist", tmdbId: title.data.tmdbId, error: String(error) }),
      );
    }
    return c.json({ ok: true, updated: true });
  };
}
