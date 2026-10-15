import { ConnectError } from "@connectrpc/connect";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bot,
  Film,
  KeyRound,
  Library,
  type LucideIcon,
  Sparkles,
  Webhook,
  Zap,
} from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { ApiSection } from "../../components/settings/api-section";
import { AutoAddSection } from "../../components/settings/auto-add-section";
import { ExtractionSection } from "../../components/settings/extraction-section";
import type { Form } from "../../components/settings/fields";
import { IdentificationSection } from "../../components/settings/identification-section";
import { McpSection } from "../../components/settings/mcp-section";
import { SaveBar } from "../../components/settings/save-bar";
import { SeerrSection } from "../../components/settings/seerr-section";
import { WebhooksSection } from "../../components/settings/webhooks-section";
import { useToast } from "../../components/toast";
import {
  changedFields,
  changes,
  errorsByField,
  toValues,
  type Values,
} from "../../lib/settings-form";
import { dependenciesQuery, settingsQuery } from "../../queries/settings";

// One tab per section. An id is also the prefix of its fields ("seerr.url"),
// which is how a tab knows it has unsaved changes.
const MENU = [
  { id: "identification", label: "Identification", icon: Sparkles },
  { id: "seerr", label: "Seerr", icon: Library },
  { id: "auto-add", label: "Auto add", icon: Zap },
  { id: "extraction", label: "Extraction", icon: Film },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "access", label: "API", icon: KeyRound },
  { id: "mcp", label: "MCP", icon: Bot },
] as const satisfies { id: string; label: string; icon: LucideIcon }[];
type SectionId = (typeof MENU)[number]["id"];

export const Route = createFileRoute("/_app/settings")({
  // ?section=seerr shows that section only; Identification without it, so
  // that its tab reads as the current one.
  validateSearch: (search: Record<string, unknown>): { section?: SectionId } => {
    const item = MENU.find((m) => m.id === search.section);
    return { section: item?.id ?? "identification" };
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

// The form holds every section's values, whichever tab shows: switching tabs
// keeps the changes, and the Save bar counts them all.
function SettingsForm({ saved }: { saved: Values }) {
  const { section = "identification" } = Route.useSearch();
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
  const changed = changedFields(values, saved);
  // "seerr.url" changed or refused: the Seerr tab gets a dot.
  const marked = new Set([...changed, ...Object.keys(errors)].map((name) => name.split(".")[0]));

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
      <div className="min-w-0">
        {section === "identification" && <IdentificationSection form={form} />}
        {section === "seerr" && <SeerrSection form={form} />}
        {section === "auto-add" && <AutoAddSection />}
        {section === "extraction" && <ExtractionSection form={form} />}
        {section === "webhooks" && <WebhooksSection form={form} />}
        {section === "access" && <ApiSection form={form} />}
        {section === "mcp" && <McpSection form={form} />}
      </div>
      {(changed.length > 0 || errors[""]) && (
        <SaveBar
          changed={changed.length}
          error={errors[""]}
          saving={save.isPending}
          onCancel={cancel}
        />
      )}
    </form>
  );
}

// A row to scroll sideways on a phone, a column on the left from md up. The
// Link marks the current tab itself, with aria-current="page". A dot marks a
// tab with unsaved changes or an error.
function SectionTabs({ current, marked }: { current: SectionId; marked: Set<string | undefined> }) {
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm md:sticky md:top-6 md:mx-0 md:flex-col md:gap-0.5 md:px-0">
      {MENU.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          ref={id === current ? scrollIntoView : undefined}
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

// On a phone the row is wider than the screen: the current tab is brought into
// view. A ref callback runs when it attaches to a tab, so on each new current
// tab, and not on every render: it is the same function each time.
function scrollIntoView(tab: HTMLAnchorElement | null) {
  tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
