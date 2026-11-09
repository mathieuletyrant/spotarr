import { Sparkles } from "lucide-react";
import { EFFORTS } from "../../lib/effort";
import { type Form, SecretField, Section, SelectField, SubHeading, TextField } from "./fields";

export function IdentificationSection({ form }: { form: Form }) {
  return (
    <Section
      id="identification"
      icon={<Sparkles aria-hidden className="size-5" />}
      title="Identification"
      description="The LLM names the works, TMDB confirms them."
    >
      <SubHeading title="LLM" description="Any OpenAI-compatible API." />
      <TextField form={form} name="identification.llmApiUrl" label="API URL" />
      <SecretField form={form} name="identification.llmApiKey" label="API key" />
      <TextField
        form={form}
        name="identification.model"
        label="Model"
        placeholder="provider/model"
        hint="Must handle images and audio."
      />
      <SelectField
        form={form}
        name="identification.effort"
        label="Effort"
        hint="Higher is slower and costs more."
        options={EFFORTS}
      />

      <SubHeading title="TMDB" description="Confirms the works and fetches details." />
      <SecretField form={form} name="identification.tmdbToken" label="Read access token" />
      <TextField
        form={form}
        name="identification.language"
        label="Title language"
        placeholder="fr-FR"
        hint="For titles and overviews, like fr-FR."
      />
    </Section>
  );
}
