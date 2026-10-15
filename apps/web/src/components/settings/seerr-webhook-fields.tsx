import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useRef } from "react";
import { settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import type { Form } from "./fields";
import { TokenField } from "./token-field";

// What Seerr sends: the title that changed. The server reads these two fields
// (api/seerr-webhook.ts) and asks Seerr where the title stands now.
const PAYLOAD = '{"type": "{{media_type}}", "tmdbId": "{{media_tmdbid}}"}';

// What to copy into Seerr's Webhook agent (Settings → Notifications → Webhook),
// so Seerr tells Spotarr when a request is approved, declined or available.
// Regenerate asks first, in a native <dialog>, like the MCP URL.
export function SeerrWebhookFields({ form }: { form: Form }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const token = form.values["access.seerrToken"] ?? "";

  const regenerate = useMutation(SpotarrService.method.regenerateSeerrToken, {
    onSuccess: async ({ seerrToken }) => {
      // In the form too, else the new token would count as an unsaved change.
      form.change("access.seerrToken", seerrToken);
      dialog.current?.close();
      toast("New Seerr token made");
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
    },
  });

  return (
    <>
      <p className="text-sm text-text-muted md:col-span-2">
        So that the history follows the library (a request approved, declined, or downloaded), turn
        on Seerr's Webhook agent in Seerr → Settings → Notifications → Webhook, with the three
        values below. Tick these notification types: Request Pending Approval, Request Automatically
        Approved, Request Approved, Request Declined, Request Available and Request Processing
        Failed.
      </p>
      <TokenField
        id="seerr-webhook-url"
        label="Webhook URL"
        value={`${window.location.origin}/seerr/webhook`}
        secret={false}
        hint="It uses this page's address; change it if Seerr reaches Spotarr at another one."
      />
      <TokenField
        id="seerr-token"
        label="Authorization header"
        value={token}
        hint="The Seerr token: it only lets Seerr report changes."
      >
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
        >
          <RefreshCw aria-hidden className="size-4" />
          Regenerate
        </button>
      </TokenField>
      <TokenField
        id="seerr-payload"
        label="JSON payload"
        value={PAYLOAD}
        secret={false}
        hint="Replaces Seerr's default payload: Spotarr only needs the title."
      />

      <dialog
        ref={dialog}
        aria-labelledby="regenerate-seerr-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-surface-raised text-text shadow-xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id="regenerate-seerr-title" className="text-lg font-semibold">
            Make a new Seerr token?
          </h2>
          <p className="text-sm text-text-muted">
            The current one stops working at once: paste the new one into Seerr's Webhook agent.
          </p>
          {regenerate.error && (
            <p className="text-sm text-status-error">{regenerate.error.rawMessage}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-10 rounded-md px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => regenerate.mutate({})}
              disabled={regenerate.isPending}
              className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface"
            >
              <RefreshCw aria-hidden className="size-4" />
              {regenerate.isPending ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
