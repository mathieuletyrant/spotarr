import { useMutation } from "@connectrpc/connect-query";
import { type Country, type Platform, SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Tv, X } from "lucide-react";
import { useState } from "react";
import { platformsQuery, settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import { inputClass, Section, SubHeading } from "./fields";

// Without a search, the most watched Platforms only: a country has a hundred.
const FIRST_SHOWN = 12;

// The Platforms subscribed to, and the country whose catalogues count. Saved
// at each click, outside the Settings form: a list of ids is not one of its
// text fields.
export function StreamingSection() {
  return (
    <Section
      id="streaming"
      icon={<Tv aria-hidden className="size-5" />}
      title="Streaming"
      description="Where you can already watch a candidate, shown on its share's page."
      info="TMDB's list of streaming platforms, from JustWatch, differs from one country to the next. Subscriptions, free and ad-supported streams count; renting and buying do not. The library (Jellyfin, Plex) is linked whenever the title is in it."
    >
      <StreamingFields />
    </Section>
  );
}

function StreamingFields() {
  const platforms = useQuery(platformsQuery());
  const settings = useQuery(settingsQuery());
  const queryClient = useQueryClient();
  const toast = useToast();
  const save = useMutation(SpotarrService.method.updateSettings, {
    onSuccess: async () => {
      toast("Streaming saved");
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
    },
  });

  if (platforms.error) {
    return <p className="text-sm text-status-error md:col-span-2">{platforms.error.message}</p>;
  }
  if (!platforms.data || !settings.data) {
    return <p className="text-sm text-text-muted md:col-span-2">Loading…</p>;
  }

  const chosen = settings.data.settings?.streaming?.platformIds ?? [];
  const country = settings.data.settings?.streaming?.country ?? "";
  const { platforms: all, countries, region } = platforms.data;

  // A present `streaming` replaces the whole list: both fields go every time.
  function choose(ids: number[]) {
    save.mutate({ settings: { streaming: { platformIds: ids, country } } });
  }

  async function chooseCountry(next: string) {
    await save.mutateAsync({ settings: { streaming: { platformIds: chosen, country: next } } });
    // Another country, other Platforms.
    await queryClient.invalidateQueries({ queryKey: platformsQuery().queryKey });
  }

  return (
    <>
      <SubHeading title="Country" description="Whose catalogues count." />
      <CountryPicker
        country={country}
        region={region}
        countries={countries}
        disabled={save.isPending}
        onChange={chooseCountry}
      />

      <SubHeading title="Your platforms" description="The ones you subscribe to." />
      <YourPlatforms
        platforms={all.filter((p) => chosen.includes(p.id))}
        disabled={save.isPending}
        onRemove={(id) => choose(chosen.filter((c) => c !== id))}
      />
      {save.error && (
        <p className="text-sm text-status-error md:col-span-2">{save.error.message}</p>
      )}

      <SubHeading title="Add a platform" />
      <OtherPlatforms
        platforms={all.filter((p) => !chosen.includes(p.id))}
        disabled={save.isPending}
        onAdd={(id) => choose([...chosen, id])}
      />
    </>
  );
}

function CountryPicker({
  country,
  region,
  countries,
  disabled,
  onChange,
}: {
  country: string;
  region: string;
  countries: Country[];
  disabled: boolean;
  onChange: (country: string) => void;
}) {
  // Empty follows the TMDB language: named after the country it gives.
  const languageCountry = country === "" ? region : "";
  const languageName = countries.find((c) => c.code === languageCountry)?.name;
  return (
    <label className="flex flex-col gap-1.5 md:col-span-2">
      <span className="sr-only">Country</span>
      <select
        value={country}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} md:max-w-xs`}
      >
        <option value="">
          {languageName ? `${flag(languageCountry)} ${languageName}` : "Same as the TMDB language"}{" "}
          (TMDB language)
        </option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {flag(c.code)} {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function YourPlatforms({
  platforms,
  disabled,
  onRemove,
}: {
  platforms: Platform[];
  disabled: boolean;
  onRemove: (id: number) => void;
}) {
  if (platforms.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-muted md:col-span-2">
        None yet: add the ones you subscribe to below.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2 md:col-span-2">
      {platforms.map((platform) => (
        <li
          key={platform.id}
          className="flex h-11 items-center gap-2.5 rounded-full border border-accent bg-accent/10 pr-1 pl-1.5"
        >
          <PlatformLogo platform={platform} />
          <span className="text-sm font-medium">{platform.name}</span>
          <button
            type="button"
            onClick={() => onRemove(platform.id)}
            disabled={disabled}
            aria-label={`Remove ${platform.name}`}
            className="flex size-8 items-center justify-center rounded-full text-text-muted hover:bg-text/8 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X aria-hidden className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function OtherPlatforms({
  platforms,
  disabled,
  onAdd,
}: {
  platforms: Platform[];
  disabled: boolean;
  onAdd: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const query = search.trim().toLowerCase();
  const found = platforms.filter((p) => p.name.toLowerCase().includes(query));
  const shown = query || showAll ? found : found.slice(0, FIRST_SHOWN);

  return (
    <div className="flex flex-col gap-3 md:col-span-2">
      <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm">
        <Search aria-hidden className="size-4 text-text-muted" />
        <span className="sr-only">Search platforms</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Crunchyroll, Netflix…"
          className="w-full bg-transparent outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:appearance-none"
        />
      </label>
      {shown.length === 0 ? (
        <p className="text-sm text-text-muted">No platform named “{search.trim()}”.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {shown.map((platform) => (
            <li key={platform.id}>
              <button
                type="button"
                onClick={() => onAdd(platform.id)}
                disabled={disabled}
                className="group flex h-14 w-full items-center gap-2 rounded-lg border border-border bg-surface px-2 text-left text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
              >
                <PlatformLogo platform={platform} />
                <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{platform.name}</span>
                <Plus
                  aria-hidden
                  className="size-4 shrink-0 text-text-muted group-hover:text-accent"
                />
                <span className="sr-only">(add)</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!query && !showAll && found.length > FIRST_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="h-9 w-fit rounded-md px-3 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
        >
          Show all {found.length}
        </button>
      )}
    </div>
  );
}

// TMDB's logo, else the name's first letter on a tile of the same size.
function PlatformLogo({ platform }: { platform: Platform }) {
  if (platform.logoUrl) {
    return <img src={platform.logoUrl} alt="" className="size-8 shrink-0 rounded-md" />;
  }
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-text/8 text-sm font-semibold text-text-muted"
    >
      {platform.name.slice(0, 1)}
    </span>
  );
}

// "FR" → 🇫🇷: each letter becomes its regional indicator symbol.
function flag(code: string): string {
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));
}
