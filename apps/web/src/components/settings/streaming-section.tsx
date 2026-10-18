import { useMutation } from "@connectrpc/connect-query";
import { type Platform, SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tv } from "lucide-react";
import { useState } from "react";
import { platformsQuery, settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import { inputClass, Section } from "./fields";

// The Platforms subscribed to. Saved at each tick, outside the Settings form:
// a list of ids is not one of its text fields.
export function StreamingSection() {
  const { data } = useQuery(platformsQuery());
  const region = data?.region;

  return (
    <Section
      id="streaming"
      icon={<Tv aria-hidden className="size-5" />}
      title="Streaming"
      description="The platforms you subscribe to. A candidate streaming on one of them links to it on its share's page."
      info={`TMDB's list of streaming platforms in your country${region ? ` (${region})` : ""}, from JustWatch. The country follows the TMDB language, in Identification. The library (Jellyfin, Plex) is always linked when the title is in it.`}
    >
      <PlatformList />
    </Section>
  );
}

function PlatformList() {
  const platforms = useQuery(platformsQuery());
  const settings = useQuery(settingsQuery());
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const save = useMutation(SpotarrService.method.updateSettings, {
    onSuccess: async () => {
      toast("Platforms saved");
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
  const all = platforms.data.platforms;
  const yours = all.filter((p) => chosen.includes(p.id));
  const others = all.filter(
    (p) => !chosen.includes(p.id) && p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function toggle(id: number) {
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    save.mutate({ settings: { streaming: { platformIds: next } } });
  }

  return (
    <div className="flex flex-col gap-4 md:col-span-2">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Yours</h3>
        {yours.length === 0 ? (
          <p className="text-sm text-text-muted">None yet: tick the ones you subscribe to below.</p>
        ) : (
          <PlatformChoices
            platforms={yours}
            chosen={chosen}
            disabled={save.isPending}
            onToggle={toggle}
          />
        )}
        {save.error && <p className="text-sm text-status-error">{save.error.message}</p>}
      </div>
      <div className="flex flex-col gap-2 border-t border-divider pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Search platforms</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Crunchyroll, Netflix…"
            className={inputClass}
          />
        </label>
        <div className="max-h-80 overflow-y-auto">
          <PlatformChoices
            platforms={others}
            chosen={chosen}
            disabled={save.isPending}
            onToggle={toggle}
          />
        </div>
      </div>
    </div>
  );
}

function PlatformChoices({
  platforms,
  chosen,
  disabled,
  onToggle,
}: {
  platforms: Platform[];
  chosen: number[];
  disabled: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {platforms.map((platform) => (
        <li key={platform.id}>
          <label className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-text/8">
            <input
              type="checkbox"
              checked={chosen.includes(platform.id)}
              disabled={disabled}
              onChange={() => onToggle(platform.id)}
              className="size-4 accent-accent"
            />
            <PlatformLogo platform={platform} />
            {platform.name}
          </label>
        </li>
      ))}
    </ul>
  );
}

function PlatformLogo({ platform }: { platform: Platform }) {
  if (!platform.logoUrl) return <span className="size-6 shrink-0 rounded-sm bg-text/8" />;
  return <img src={platform.logoUrl} alt="" className="size-6 shrink-0 rounded-sm" />;
}
