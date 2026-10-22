import { Sofa } from "lucide-react";
import { type Form, SecretField, Section } from "./fields";

// Snug, the series tracker: a TV show can go on its Watchlist instead of Seerr.
export function SnugSection({ form }: { form: Form }) {
  return (
    <Section
      id="snug"
      icon={<Sofa aria-hidden className="size-5" />}
      title="Snug"
      description="TV shows on Snug's Watchlist instead of Seerr. Optional: leave the URL empty to turn it off."
      info="Once set, a Rule can take the action Add to Snug's Watchlist (TV shows only), and a TV show's Watchlist button sends it to Snug. Nothing is requested. Snug keeps the status of a series it already tracks."
    >
      <SecretField
        form={form}
        name="snug.watchlistUrl"
        label="Watchlist URL"
        placeholder="In Snug: Settings → Integrations → Spotarr → Copy URL"
        wide
      />
    </Section>
  );
}
