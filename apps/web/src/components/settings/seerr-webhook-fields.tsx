import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { settingsQuery } from "../../queries/settings";
import { useToast } from "../toast";
import { CopyField } from "./copy-field";
import type { Form } from "./fields";
import { RegenerateButton } from "./regenerate-button";
import { Step } from "./step";

// What Seerr sends: the title that changed. The server reads these two fields
// (api/seerr-webhook.ts) and asks Seerr where the title stands now.
const PAYLOAD = '{"type": "{{media_type}}", "tmdbId": "{{media_tmdbid}}"}';

// Seerr's request notifications, as its English UI names them. The Issue ones
// say nothing about the library.
const NOTIFICATION_TYPES = [
  "Request Pending Approval",
  "Request Automatically Approved",
  "Request Approved",
  "Request Declined",
  "Request Available",
  "Request Processing Failed",
];

// What to copy into Seerr's Webhook agent (Settings → Notifications → Webhook),
// so Seerr tells Spotarr when a request is approved, declined or available.
export function SeerrWebhookFields({ form }: { form: Form }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const token = form.values["access.seerrToken"] ?? "";

  const regenerate = useMutation(SpotarrService.method.regenerateSeerrToken, {
    onSuccess: async ({ seerrToken }) => {
      // In the form too, else the new token would count as an unsaved change.
      form.change("access.seerrToken", seerrToken);
      toast("New Seerr token made");
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
    },
  });

  return (
    <ol className="flex flex-col gap-6 md:col-span-2">
      <Step
        n={1}
        title="In Seerr, open Settings → Notifications → Webhook and tick Enable Agent."
      />
      <Step n={2} title="Copy these three values into it.">
        <CopyField
          id="seerr-webhook-url"
          label="Webhook URL"
          value={`${window.location.origin}/seerr/webhook`}
          secret={false}
          hint="It uses this page's address; change it if Seerr reaches Spotarr at another one."
        />
        <CopyField
          id="seerr-token"
          label="Authorization header"
          value={token}
          hint="The Seerr token: it only lets Seerr report changes."
        >
          <RegenerateButton
            id="regenerate-seerr"
            question="Make a new Seerr token?"
            warning="The current one stops working at once: paste the new one into Seerr's Webhook agent."
            regenerate={() => regenerate.mutateAsync({})}
          />
        </CopyField>
        <CopyField
          id="seerr-payload"
          label="JSON payload"
          value={PAYLOAD}
          secret={false}
          hint="Replaces Seerr's default payload: Spotarr only needs the title."
        />
      </Step>
      <Step n={3} title="Tick these notification types, and leave the Issue ones.">
        <ul className="flex flex-wrap gap-1.5">
          {NOTIFICATION_TYPES.map((type) => (
            <li key={type} className="rounded-full bg-text/8 px-2.5 py-1 text-xs font-medium">
              {type}
            </li>
          ))}
        </ul>
      </Step>
      <Step n={4} title="Press Test: Seerr shows it passed. Then Save." />
    </ol>
  );
}
