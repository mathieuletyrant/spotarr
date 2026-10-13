import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Film,
  KeyRound,
  Library,
  type LucideIcon,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { type SubmitEvent, useEffect, useState } from "react";
import { ApiTokenField } from "../../components/settings/api-token-field";
import { AutoAddFields } from "../../components/settings/auto-add-fields";
import { DependenciesCard } from "../../components/settings/dependencies-card";
import {
  Field,
  type Form,
  inputClass,
  SecretField,
  Section,
  TextField,
} from "../../components/settings/fields";
import { WebhooksList } from "../../components/settings/webhooks-list";
import { useToast } from "../../components/toast";
import {
  changedFields,
  changes,
  errorsByField,
  toValues,
  type Values,
} from "../../lib/settings-form";
import { dependenciesQuery, settingsQuery } from "../../queries/settings";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const MENU: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "status", label: "Status", icon: Activity },
  { id: "identification", label: "Identification", icon: Sparkles },
  { id: "seerr", label: "Seerr", icon: Library },
  { id: "auto-add", label: "Auto add", icon: Zap },
  { id: "extraction", label: "Extraction", icon: Film },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "access", label: "Access", icon: KeyRound },
];

// The section at the top of the screen, to highlight it in the menu.
function useSectionInView(ready: boolean): string {
  const [inView, setInView] = useState("status");
  useEffect(() => {
    if (!ready) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setInView(entry.target.id);
      },
      // A section counts once it reaches the top third of the screen.
      { rootMargin: "0px 0px -66% 0px" },
    );
    for (const { id } of MENU) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [ready]);
  return inView;
}

function SettingsPage() {
  const { data, error } = useQuery(settingsQuery());
  const inView = useSectionInView(data !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-text-muted">Everything Spotarr needs, saved on the server.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
        <nav className="hidden flex-col gap-0.5 text-sm md:sticky md:top-6 md:flex">
          {MENU.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={inView === id ? "location" : undefined}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-text-muted hover:bg-text/8 hover:text-text aria-[current]:bg-text/8 aria-[current]:font-medium aria-[current]:text-text"
            >
              <Icon aria-hidden className="size-4" />
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
  const toast = useToast();
  const [values, setValues] = useState(saved);
  const [errors, setErrors] = useState<Values>({});
  const save = useMutation(SpotarrService.method.updateSettings, {
    onSuccess: async ({ settings }) => {
      if (settings) setValues(toValues(settings));
      setErrors({});
      toast("Settings saved");
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
        icon={<Sparkles aria-hidden className="size-5" />}
        title="Identification"
        description="The LLM names the works, TMDB confirms them. Any OpenAI-compatible API works."
      >
        <TextField form={form} name="identification.llmApiUrl" label="API URL" wide />
        <SecretField form={form} name="identification.llmApiKey" label="API key" wide />
        <TextField
          form={form}
          name="identification.model"
          label="Model"
          placeholder="provider/model"
          hint="It gets the video's frames and sound: it must read images and hear audio."
          wide
        />
        <SecretField form={form} name="identification.tmdbToken" label="TMDB token (read access)" />
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
        icon={<Library aria-hidden className="size-5" />}
        title="Seerr"
        description="Where Spotarr checks the library and sends additions."
      >
        <TextField form={form} name="seerr.url" label="URL" placeholder="http://seerr:5055" />
        <SecretField
          form={form}
          name="seerr.apiKey"
          label="API key"
          placeholder="Paste Seerr's API key"
        />
      </Section>

      <Section
        id="auto-add"
        icon={<Zap aria-hidden className="size-5" />}
        title="Auto add"
        description="Request a candidate without a click, when Spotarr is sure of it."
      >
        <AutoAddFields form={form} />
      </Section>

      <Section
        id="extraction"
        icon={<Film aria-hidden className="size-5" />}
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
            max={15}
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
        <Field
          form={form}
          name="extraction.concurrency"
          label="Identifications at the same time"
          hint="Applies when Spotarr restarts."
        >
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

      <Section
        id="access"
        icon={<KeyRound aria-hidden className="size-5" />}
        title="Access"
        description="The token that lets the iPhone and scripts call Spotarr."
      >
        <ApiTokenField token={values["access.apiToken"] ?? ""} />
      </Section>

      {(changed > 0 || errors[""]) && (
        <div className="fixed inset-x-0 bottom-6 z-10 flex justify-center px-4">
          <div className="flex items-center gap-4 rounded-full border border-border bg-surface-raised py-2 pr-2 pl-5 shadow-lg">
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
                className="h-9 rounded-full px-4 text-sm font-medium text-text-muted hover:bg-text/8 hover:text-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={save.isPending || changed === 0}
                className="h-9 rounded-full bg-accent px-5 text-sm font-medium text-accent-text"
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
