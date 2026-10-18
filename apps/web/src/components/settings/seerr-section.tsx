import { Bell, ChevronDown, Library } from "lucide-react";
import { ConnectionState } from "./connection-state";
import { type Form, SecretField, Section, SubHeading, TextField } from "./fields";
import { SeerrWebhookFields } from "./seerr-webhook-fields";

export function SeerrSection({ form }: { form: Form }) {
  return (
    <Section
      id="seerr"
      icon={<Library aria-hidden className="size-5" />}
      title="Seerr"
      description="The library: where requests go, and what tells Spotarr when it changes."
      action={<ConnectionState name="Seerr" />}
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

      {/* Set up once in Seerr, then rarely looked at: closed until asked. */}
      <details className="group rounded-lg border border-border md:col-span-2">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg p-4 hover:bg-text/4 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Bell aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Notifications</span>
            <span className="block text-sm text-text-muted">
              Seerr tells Spotarr when a request is approved, declined or downloaded, and the
              history follows.
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t border-divider p-4">
          <SeerrWebhookFields form={form} />
        </div>
      </details>
    </Section>
  );
}
