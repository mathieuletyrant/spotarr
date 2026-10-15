import { Film } from "lucide-react";
import { Field, type Form, inputClass, Section, SelectField } from "./fields";

const CONCURRENCY = ["1", "2", "3", "4"].map((n) => ({ value: n, label: n }));

export function ExtractionSection({ form }: { form: Form }) {
  const frames = form.values["extraction.framesPerVideo"] ?? "";
  return (
    <Section
      id="extraction"
      icon={<Film aria-hidden className="size-5" />}
      title="Extraction"
      description="How Spotarr reads shared videos."
    >
      <Field
        form={form}
        name="extraction.framesPerVideo"
        label={`Frames per video: ${frames}`}
        hint="More frames: better identification, more expensive LLM call."
      >
        <input
          type="range"
          min={1}
          max={15}
          value={frames}
          onChange={(e) => form.change("extraction.framesPerVideo", e.target.value)}
          className="h-10 accent-accent"
        />
      </Field>
      <Field form={form} name="extraction.maxVideoMb" label="Largest video (MB)">
        <input
          type="number"
          min={1}
          max={2000}
          value={form.values["extraction.maxVideoMb"] ?? ""}
          onChange={(e) => form.change("extraction.maxVideoMb", e.target.value)}
          className={inputClass}
        />
      </Field>
      <SelectField
        form={form}
        name="extraction.concurrency"
        label="Identifications at the same time"
        hint="Applies when Spotarr restarts."
        options={CONCURRENCY}
      />
    </Section>
  );
}
