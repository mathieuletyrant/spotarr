import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Bot,
  Film,
  KeyRound,
  Library,
  type LucideIcon,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { DependenciesCard } from "../../components/settings/dependencies-card";
import {
  Field,
  type Form,
  inputClass,
  SecretField,
  Section,
  SubHeading,
  TextField,
} from "../../components/settings/fields";
import { McpUrlField } from "../../components/settings/mcp-url-field";
import { RulesList } from "../../components/settings/rules-list";
import { SeerrWebhookFields } from "../../components/settings/seerr-webhook-fields";
import { TokenField } from "../../components/settings/token-field";
import { WebhooksList } from "../../components/settings/webhooks-list";
import { useToast } from "../../components/toast";
import { EFFORTS } from "../../lib/effort";
import {
  changedFields,
  changes,
  errorsByField,
  toValues,
  type Values,
} from "../../lib/settings-form";
import { dependenciesQuery, settingsQuery } from "../../queries/settings";

const MENU = [
  { id: "status", label: "Status", icon: Activity },
  { id: "identification", label: "Identification", icon: Sparkles },
  { id: "seerr", label: "Seerr", icon: Library },
  { id: "auto-add", label: "Auto add", icon: Zap },
  { id: "extraction", label: "Extraction", icon: Film },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "access", label: "API", icon: KeyRound },
  { id: "mcp", label: "MCP", icon: Bot },
] as const satisfies { id: string; label: string; icon: LucideIcon }[];
type SectionId = (typeof MENU)[number]["id"];

// The MCP server's tools (apps/server/src/api/mcp/), as the MCP tab lists them.
const MCP_TOOLS = [
  {
    name: "list_shares",
    description:
      "The history, newest first, with each Share's candidates and where they stand. Filters by status, genre and text.",
  },
  {
    name: "list_genres",
    description: "Every genre of the history, most Shares first: the names list_shares filters by.",
  },
];

export const Route = createFileRoute("/_app/settings")({
  // ?section=seerr shows that section only; Status without it, so that its tab
  // reads as the current one.
  validateSearch: (search: Record<string, unknown>): { section?: SectionId } => {
    const item = MENU.find((m) => m.id === search.section);
    return { section: item?.id ?? "status" };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { data, error } = useQuery(settingsQuery());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-text-muted">Everything Spotarr needs, saved on the server.</p>
      </div>
      {error && <p className="text-status-error">{error.message}</p>}
      {data?.settings && <SettingsForm saved={toValues(data.settings)} />}
    </div>
  );
}

// One tab per section: a row to scroll sideways on a phone, a column on the
// left from md up. A dot marks a section with unsaved changes or an error,
// since the Save bar counts the changes of every section.
// The Link marks the current tab itself, with aria-current="page".
function SectionTabs({ current, marked }: { current: SectionId; marked: Set<string> }) {
  const nav = useRef<HTMLElement>(null);
  // On a phone the row is wider than the screen: bring the current tab into view.
  useEffect(() => {
    nav.current
      ?.querySelector(`[href*="section=${current}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  return (
    <nav
      ref={nav}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm md:sticky md:top-6 md:mx-0 md:flex-col md:gap-0.5 md:px-0"
    >
      {MENU.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          to="/settings"
          search={{ section: id }}
          className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 whitespace-nowrap text-text-muted hover:bg-text/8 hover:text-text focus-visible:outline-2 focus-visible:outline-accent aria-[current]:bg-text/8 aria-[current]:font-medium aria-[current]:text-text"
        >
          <Icon aria-hidden className="size-4" />
          {label}
          {marked.has(id) && (
            <span className="size-1.5 rounded-full bg-accent">
              <span className="sr-only">(unsaved changes)</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

function SettingsForm({ saved }: { saved: Values }) {
  const { section = "status" } = Route.useSearch();
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
  // "seerr.url" changed or refused: the Seerr tab gets a dot.
  const marked = new Set(
    [...changedFields(values, saved), ...Object.keys(errors)].map(
      (name) => name.split(".")[0] ?? "",
    ),
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    save.mutate({ settings: changes(values, saved) });
  }

  function cancel() {
    setValues(saved);
    setErrors({});
  }

  return (
    <form
      onSubmit={submit}
      className="grid grid-cols-1 gap-6 pb-24 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start"
    >
      <SectionTabs current={section} marked={marked} />
      <div className="flex min-w-0 flex-col gap-6">
        {section === "status" && <DependenciesCard />}

        {section === "identification" && (
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
            <Field
              form={form}
              name="identification.effort"
              label="Effort"
              hint="How long the LLM thinks: higher is slower and dearer. Retry can ask for another."
            >
              <select
                value={values["identification.effort"]}
                onChange={(e) => form.change("identification.effort", e.target.value)}
                className={inputClass}
              >
                {EFFORTS.map((effort) => (
                  <option key={effort.value} value={effort.value}>
                    {effort.label}
                  </option>
                ))}
              </select>
            </Field>
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
        )}

        {section === "seerr" && (
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
        )}

        {section === "auto-add" && (
          <Section
            id="auto-add"
            icon={<Zap aria-hidden className="size-5" />}
            title="Auto add"
            description="Rules that request a candidate without a click."
            info="A candidate is requested through Seerr when one enabled rule holds for it, and credited to the first one. A title already in the library is never requested again; a TV show gets season 1."
          >
            <RulesList />
          </Section>
        )}

        {section === "extraction" && (
          <Section
            id="extraction"
            icon={<Film aria-hidden className="size-5" />}
            title="Extraction"
            description="How Spotarr reads shared videos."
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
        )}

        {section === "webhooks" && (
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
        )}

        {section === "access" && (
          <Section
            id="access"
            icon={<KeyRound aria-hidden className="size-5" />}
            title="API"
            description="What lets the iPhone and scripts call Spotarr, with every right."
          >
            <TokenField
              id="api-token"
              label="API token"
              value={values["access.apiToken"] ?? ""}
              hint="Sent by the iPhone and scripts in the Authorization header. It also signs in to this page."
            />
          </Section>
        )}

        {section === "mcp" && (
          <Section
            id="mcp"
            icon={<Bot aria-hidden className="size-5" />}
            title="MCP"
            description="Lets an AI assistant like Claude read the history: read-only, it changes nothing."
          >
            <McpUrlField form={form} />
            <SubHeading title="Tools" description="What the assistant can call. Both only read." />
            <ul className="flex flex-col gap-3 md:col-span-2">
              {MCP_TOOLS.map((tool) => (
                <li key={tool.name} className="flex flex-col gap-0.5 text-sm">
                  <code className="w-fit rounded bg-text/8 px-1.5 py-0.5 font-mono text-xs">
                    {tool.name}
                  </code>
                  <span className="text-text-muted">{tool.description}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

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
