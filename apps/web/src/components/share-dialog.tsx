import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useNavigate } from "@tanstack/react-router";
import { Link2, X } from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

// Paste a video link from the computer: Spotarr identifies it like a share
// from the iPhone, then the Share's page follows the Identification. A native
// <dialog>: Escape and the backdrop close it, and focus stays inside.
export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const create = useMutation(SpotarrService.method.createShare, {
    onSuccess: ({ share }) => {
      setUrl("");
      if (share) navigate({ to: "/shares/$shareId", params: { shareId: share.id } });
    },
  });

  useEffect(() => {
    if (open && !dialog.current?.open) {
      dialog.current?.showModal();
      field.current?.focus(); // ready to paste
    }
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function submit(event: SubmitEvent) {
    event.preventDefault();
    create.mutate({ url: url.trim() });
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard closes it with Escape, natively
    <dialog
      ref={dialog}
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself, outside its content.
      onClick={(event) => event.target === dialog.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Share a link</h2>
            <p className="mt-1 text-sm text-text-muted">
              A reel, a TikTok or a YouTube video: Spotarr finds the films and shows it mentions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-text/8 hover:text-text"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <label className="flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 focus-within:outline-2 focus-within:outline-accent">
          <Link2 aria-hidden className="size-4 text-text-muted" />
          <span className="sr-only">Video link</span>
          <input
            ref={field}
            type="url"
            required
            placeholder="https://www.instagram.com/reel/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-text-muted"
          />
        </label>
        {create.error && (
          <p className="-mt-2 text-sm text-status-error">{create.error.rawMessage}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="h-10 rounded-md bg-accent px-5 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {create.isPending ? "Sending…" : "Identify"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
