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
      <SubHeading
        title="LLM"
        description="Reads what was shared and names the works. Any OpenAI-compatible API works."
      />
      <TextField form={form} name="identification.llmApiUrl" label="API URL" />
      <SecretField form={form} name="identification.llmApiKey" label="API key" />
      <TextField
        form={form}
        name="identification.model"
        label="Model"
        placeholder="provider/model"
        hint="It gets a video's frames and sound, or a page's text and pictures: it must read images and hear audio."
      />
      <SelectField
        form={form}
        name="identification.effort"
        label="Effort"
        hint="How long the LLM thinks: higher is slower and dearer. Retry can ask for another."
        options={EFFORTS}
      />

      <SubHeading title="TMDB" description="Confirms the works and gives their details." />
      <SecretField form={form} name="identification.tmdbToken" label="Read access token" />
      <TextField
        form={form}
        name="identification.language"
        label="Title language"
        placeholder="fr-FR"
        hint="Language of the titles and overviews, as a tag like fr-FR or en-US."
      />
    </Section>
  );
}
