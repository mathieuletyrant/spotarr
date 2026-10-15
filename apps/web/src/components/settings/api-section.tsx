import { KeyRound } from "lucide-react";
import { CopyField } from "./copy-field";
import { type Form, Section } from "./fields";

export function ApiSection({ form }: { form: Form }) {
  return (
    <Section
      id="access"
      icon={<KeyRound aria-hidden className="size-5" />}
      title="API"
      description="What lets the iPhone and scripts call Spotarr, with every right."
    >
      <CopyField
        id="api-token"
        label="API token"
        value={form.values["access.apiToken"] ?? ""}
        hint="Sent by the iPhone and scripts in the Authorization header. It also signs in to this page."
      />
    </Section>
  );
}
