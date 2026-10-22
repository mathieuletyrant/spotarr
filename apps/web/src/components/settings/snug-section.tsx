import { Sofa } from "lucide-react";
import { type Form, SecretField, Section } from "./fields";

// Snug, the series tracker: every TV show Spotarr adds lands on its Watchlist.
export function SnugSection({ form }: { form: Form }) {
  return (
    <Section
      id="snug"
      icon={<Sofa aria-hidden className="size-5" />}
      title="Snug"
      description="Every TV show Spotarr adds lands on Snug's Watchlist. Optional: leave the URL empty to turn it off."
      info="On top of Seerr: a TV show requested, already in the library or put in Seerr's watchlist also goes to Snug. Snug keeps the status of a series it already tracks. If Snug can't be reached, Seerr's part still stands."
    >
      <SecretField
        form={form}
        name="snug.watchlistUrl"
        label="Watchlist URL"
        placeholder="In Snug: Settings → Spotarr → Copy URL"
        wide
      />
    </Section>
  );
}
