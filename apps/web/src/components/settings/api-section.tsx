import { KeyRound } from "lucide-react";
import { CopyField } from "./copy-field";
import { type Form, Section } from "./fields";

export function ApiSection({ form }: { form: Form }) {
  return (
    <Section
      id="access"
      icon={<KeyRound aria-hidden className="size-5" />}
      title="API"
      description="Full access for the iPhone Shortcut and scripts."
    >
      <CopyField
        id="api-token"
        label="API token"
        value={form.values["access.apiToken"] ?? ""}
        hint="Sent in the Authorization header. Also signs in to this page."
      />
    </Section>
  );
}
