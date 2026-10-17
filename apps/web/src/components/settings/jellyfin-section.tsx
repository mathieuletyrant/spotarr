import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { RefreshCw, Tv } from "lucide-react";
import { describeSync } from "../../lib/collection";
import { CopyField } from "./copy-field";
import { type Form, SecretField, Section, SubHeading, TextField } from "./fields";
import { Step } from "./step";

// Where the Home Screen Sections and Collection Sections plugins are published.
const PLUGIN_REPOSITORY = "https://www.iamparadox.dev/jellyfin/plugins/manifest.json";

// `unsaved`: a Jellyfin field changed and is not saved yet. The sync reads
// the saved settings, so Sync now waits for Save.
export function JellyfinSection({ form, unsaved }: { form: Form; unsaved: boolean }) {
  return (
    <Section
      id="jellyfin"
      icon={<Tv aria-hidden className="size-5" />}
      title="Jellyfin"
      description="A collection of what you spotted, to find it on the TV. Optional."
      info="The Collection holds the titles added from a Share that Jellyfin has and you have not watched yet. Spotarr syncs it every 15 minutes, and when Seerr says a title is available."
    >
      <SubHeading title="Connection" description="Leave the URL empty to turn Jellyfin off." />
      <TextField form={form} name="jellyfin.url" label="URL" placeholder="http://jellyfin:8096" />
      <SecretField
        form={form}
        name="jellyfin.apiKey"
        label="API key"
        placeholder="Dashboard → API Keys → +"
      />
      <TextField
        form={form}
        name="jellyfin.user"
        label="User"
        placeholder="Your Jellyfin user name"
        hint="What this user watched leaves the Collection."
      />

      <SubHeading
        title="Collection"
        description="Spotarr owns it: a title put in it by hand goes at the next sync."
      />
      <TextField
        form={form}
        name="jellyfin.collection"
        label="Name"
        placeholder="Spotted"
        hint="Renamed, a new collection is made; delete the old one in Jellyfin."
      />
      <SyncNow disabled={unsaved || !form.values["jellyfin.url"]} unsaved={unsaved} />

      <SubHeading
        title="On the TV"
        description="To see the Collection as a row of Jellyfin's Home, on the web and in JellyTV."
      />
      <ol className="flex flex-col gap-6 md:col-span-2">
        <Step n={1} title="In Jellyfin's Dashboard, under Plugins, add this repository.">
          <CopyField
            id="jellyfin-plugin-repository"
            label="Repository URL"
            value={PLUGIN_REPOSITORY}
            secret={false}
            hint="Third-party plugins, by IAmParadox. They follow Jellyfin's versions closely."
          />
        </Step>
        <Step
          n={2}
          title="Install Home Screen Sections, then Collection Sections, and restart Jellyfin."
        />
        <Step
          n={3}
          title="In Collection Sections' settings, add a section showing the Collection."
        />
        <Step
          n={4}
          title="In JellyTV, turn the section on in the Home settings (part of JellyTV+)."
        />
      </ol>
    </Section>
  );
}

// Syncs the Collection now and says what it did, or why it failed.
function SyncNow({ disabled, unsaved }: { disabled: boolean; unsaved: boolean }) {
  const sync = useMutation(SpotarrService.method.syncCollection);

  let message = "Spotarr also syncs on its own, every 15 minutes.";
  if (unsaved) message = "Save first: the sync uses the saved settings.";
  else if (sync.data) message = describeSync(sync.data);

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || sync.isPending}
          onClick={() => sync.mutate({})}
          className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <RefreshCw aria-hidden className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} />
          Sync now
        </button>
        {sync.error && !unsaved ? (
          <p className="text-sm text-status-error">{ConnectError.from(sync.error).rawMessage}</p>
        ) : (
          <p className="text-sm text-text-muted" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
