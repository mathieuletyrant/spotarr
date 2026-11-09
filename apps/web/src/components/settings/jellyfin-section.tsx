import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { Link } from "@tanstack/react-router";
import { FolderHeart, RefreshCw, Tv } from "lucide-react";
import { describeSync } from "../../lib/collection";
import { ConnectionState } from "./connection-state";
import { type Form, SecretField, Section, TextField } from "./fields";

// The Jellyfin connection: where it answers, and whose watched titles count.
export function JellyfinSection({ form }: { form: Form }) {
  return (
    <Section
      id="jellyfin"
      icon={<Tv aria-hidden className="size-5" />}
      title="Jellyfin"
      description="Keeps a collection of what you spotted. Optional."
      action={<ConnectionState name="Jellyfin" />}
    >
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
        hint="Titles this user watched leave the collection."
      />
    </Section>
  );
}

// The Collection Spotarr keeps in Jellyfin, in Automation: it runs on its
// own. `unsaved`: a Jellyfin field changed and is not saved yet. The sync
// reads the saved settings, so Sync now waits for Save.
export function CollectionSection({ form, unsaved }: { form: Form; unsaved: boolean }) {
  return (
    <Section
      id="collection"
      icon={<FolderHeart aria-hidden className="size-5" />}
      title="Jellyfin collection"
      description="Spotted titles, from download until watched."
      info="Shows under Collections in Jellyfin and JellyTV. Spotarr manages it: titles added by hand are removed. Syncs every 15 minutes and when Seerr reports a title available."
    >
      {form.values["jellyfin.url"] ? (
        <>
          <TextField
            form={form}
            name="jellyfin.collection"
            label="Name"
            placeholder="Spotted"
            hint="Renaming creates a new one. Delete the old one in Jellyfin."
          />
          <SyncNow disabled={unsaved} unsaved={unsaved} />
        </>
      ) : (
        <p className="text-sm text-text-muted md:col-span-2">
          Set up Jellyfin in{" "}
          <Link
            to="/settings"
            search={{ section: "connections" }}
            className="font-medium text-text underline"
          >
            Connections
          </Link>{" "}
          first.
        </p>
      )}
    </Section>
  );
}

// Syncs the Collection now and says what it did, or why it failed.
function SyncNow({ disabled, unsaved }: { disabled: boolean; unsaved: boolean }) {
  const sync = useMutation(SpotarrService.method.syncCollection);

  let message = "Also syncs every 15 minutes.";
  if (unsaved) message = "Save first.";
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
