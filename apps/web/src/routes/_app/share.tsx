import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { type SubmitEvent, useState } from "react";

export const Route = createFileRoute("/_app/share")({ component: SharePage });

// From a computer: paste a video link, Spotarr identifies it like a share
// from the iPhone. The Share's page then follows the Identification.
function SharePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const create = useMutation(SpotarrService.method.createShare, {
    onSuccess: ({ share }) =>
      share && navigate({ to: "/shares/$shareId", params: { shareId: share.id } }),
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    create.mutate({ url: url.trim() });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Share</h1>
        <p className="mt-1 text-text-muted">
          Paste a link to a reel, a TikTok or a YouTube video. Spotarr finds the films and shows
          they mention.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-3">
          <Link2 aria-hidden className="size-4 text-text-muted" />
          <span className="sr-only">Video link</span>
          <input
            type="url"
            required
            placeholder="https://www.instagram.com/reel/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-text-muted"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="h-11 rounded-md bg-accent px-5 font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {create.isPending ? "Sending…" : "Identify"}
        </button>
      </form>
      {create.error && <p className="text-sm text-status-error">{create.error.rawMessage}</p>}
    </div>
  );
}
