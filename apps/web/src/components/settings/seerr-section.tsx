import { Library } from "lucide-react";
import { type Form, SecretField, Section, SubHeading, TextField } from "./fields";
import { SeerrWebhookFields } from "./seerr-webhook-fields";

export function SeerrSection({ form }: { form: Form }) {
  return (
    <Section
      id="seerr"
      icon={<Library aria-hidden className="size-5" />}
      title="Seerr"
      description="The library: where requests go, and what tells Spotarr when it changes."
    >
      <SubHeading
        title="Connection"
        description="Where Spotarr checks the library and sends requests."
      />
      <TextField form={form} name="seerr.url" label="URL" placeholder="http://seerr:5055" />
      <SecretField
        form={form}
        name="seerr.apiKey"
        label="API key"
        placeholder="Paste Seerr's API key"
      />

      <SubHeading
        title="Notifications"
        description="Seerr tells Spotarr when a request is approved, declined or downloaded, and the history follows."
      />
      <SeerrWebhookFields form={form} />
    </Section>
  );
}
