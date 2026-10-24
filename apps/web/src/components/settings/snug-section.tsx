import { Sofa } from "lucide-react";
import { type Form, SecretField, Section } from "./fields";

// Snug, the series tracker: a TV show can go on its Watchlist instead of Seerr.
export function SnugSection({ form }: { form: Form }) {
  return (
    <Section
      id="snug"
      icon={<Sofa aria-hidden className="size-5" />}
      title="Snug"
      description="Send TV shows to Snug's Watchlist instead of Seerr. Optional."
      info="Adds a Snug action to rules and to TV show buttons. Nothing is downloaded. A series Snug already tracks keeps its status."
    >
      <SecretField
        form={form}
        name="snug.watchlistUrl"
        label="Watchlist URL"
        placeholder="Snug → Settings → Integrations → Spotarr"
        wide
      />
    </Section>
  );
}
