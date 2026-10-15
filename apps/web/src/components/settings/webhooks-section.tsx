import { Webhook } from "lucide-react";
import { type Form, Section, TextField } from "./fields";
import { WebhooksList } from "./webhooks-list";

export function WebhooksSection({ form }: { form: Form }) {
  return (
    <Section
      id="webhooks"
      icon={<Webhook aria-hidden className="size-5" />}
      title="Webhooks"
      description="Spotarr calls these URLs when something happens to a share."
    >
      <TextField
        form={form}
        name="webhooks.webUiUrl"
        label="Web UI address"
        placeholder="https://spotarr.example.com"
        hint="Events then link to the share's page at this address."
        wide
      />
      <WebhooksList />
    </Section>
  );
}
