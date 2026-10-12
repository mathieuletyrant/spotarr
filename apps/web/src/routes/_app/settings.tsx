import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { ApiTokenField } from "../../components/settings/api-token-field";
import { DependenciesCard } from "../../components/settings/dependencies-card";
import { Field, type Form, inputClass, Section, TextField } from "../../components/settings/fields";
import {
  changedFields,
  changes,
  errorsByField,
  toValues,
  type Values,
} from "../../lib/settings-form";
import { dependenciesQuery, settingsQuery } from "../../queries/settings";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const MENU = [
  ["status", "Status"],
  ["identification", "Identification"],
  ["seerr", "Seerr"],
  ["extraction", "Extraction"],
  ["access", "Access"],
];

function SettingsPage() {
  const { data, error } = useQuery(settingsQuery());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-text-muted">Everything Spotarr needs, saved on the server.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
        <nav className="hidden flex-col gap-1 text-sm md:sticky md:top-6 md:flex">
          {MENU.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-md px-3 py-1.5 text-text-muted hover:bg-text/8 hover:text-text"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col gap-6">
          <DependenciesCard />
          {error && <p className="text-status-error">{error.message}</p>}
          {data?.settings && <SettingsForm saved={toValues(data.settings)} />}
        </div>
      </div>
    </div>
  );
}

function SettingsForm({ saved }: { saved: Values }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Values>({});
  const save = useMutation(SpotarrService.method.updateSettings, {
    onSuccess: async ({ settings }) => {
      if (settings) setValues(toValues(settings));
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: settingsQuery().queryKey });
      // New keys or URLs: check the Dependencies again.
      await queryClient.invalidateQueries({ queryKey: dependenciesQuery().queryKey });
    },
    onError: (error) => setErrors(errorsByField(ConnectError.from(error).rawMessage)),
  });

  const form: Form = {
    values,
    errors,
    change: (name, value) => setValues({ ...values, [name]: value }),
  };
  const changed = changedFields(values, saved).length;

  function submit(event: SubmitEvent) {
    event.preventDefault();
    save.mutate({ settings: changes(values, saved) });
  }

  function cancel() {
    setValues(saved);
    setErrors({});
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 pb-24">
      <Section
        id="identification"
        title="Identification"
        description="The LLM names the works, TMDB confirms them. Any OpenAI-compatible API works."
      >
        <TextField form={form} name="identification.llmApiUrl" label="API URL" wide />
        <TextField form={form} name="identification.llmApiKey" label="API key" wide />
        <TextField
          form={form}
          name="identification.model"
          label="Model"
          placeholder="provider/model"
          hint="It gets the video's frames and sound: it must read images and hear audio."
          wide
        />
        <TextField form={form} name="identification.tmdbToken" label="TMDB token (read access)" />
        <TextField
          form={form}
          name="identification.language"
          label="Title language"
          placeholder="fr-FR"
          hint="Language of the titles, as a tag like fr-FR or en-US."
        />
      </Section>

      <Section
        id="seerr"
        title="Seerr"
        description="Where Spotarr checks the library and sends additions."
      >
        <TextField form={form} name="seerr.url" label="URL" placeholder="http://seerr:5055" />
        <TextField
          form={form}
          name="seerr.apiKey"
          label="API key"
          placeholder="Paste Seerr's API key"
        />
      </Section>

      <Section
        id="extraction"
        title="Extraction"
        description="What Spotarr reads from shared videos."
      >
        <Field
          form={form}
          name="extraction.framesPerVideo"
          label={`Frames per video: ${values["extraction.framesPerVideo"]}`}
          hint="More frames: better identification, more expensive LLM call."
        >
          <input
            type="range"
            min={1}
            max={8}
            value={values["extraction.framesPerVideo"]}
            onChange={(e) => form.change("extraction.framesPerVideo", e.target.value)}
            className="h-10 accent-accent"
          />
        </Field>
        <Field form={form} name="extraction.maxVideoMb" label="Largest video (MB)">
          <input
            type="number"
            min={1}
            max={2000}
            value={values["extraction.maxVideoMb"]}
            onChange={(e) => form.change("extraction.maxVideoMb", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field form={form} name="extraction.concurrency" label="Identifications at the same time">
          <select
            value={values["extraction.concurrency"]}
            onChange={(e) => form.change("extraction.concurrency", e.target.value)}
            className={inputClass}
          >
            {["1", "2", "3", "4"].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section
        id="access"
        title="Access"
        description="The token that lets the iPhone and scripts call Spotarr."
      >
        <ApiTokenField token={values["access.apiToken"] ?? ""} />
      </Section>

      {(changed > 0 || errors[""]) && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p className="text-sm">
              {errors[""] ? (
                <span className="text-status-error">{errors[""]}</span>
              ) : (
                `${changed} unsaved ${changed === 1 ? "change" : "changes"}`
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="h-9 rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending || changed === 0}
                className="h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
