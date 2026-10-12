import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService, type Webhook } from "@spotarr/contract";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { webhooksQuery } from "../../queries/settings";
import { inputClass } from "./fields";

const EVENTS = [
  ["identification.ready", "Candidates found"],
  ["identification.no_match", "No match"],
  ["identification.failed", "Failed"],
  ["media.added", "Added"],
];

const buttonClass = "h-9 rounded-md border border-border px-3 text-sm font-medium";

// One Webhook, edited in place and saved on its own. Without `webhook`, a new one.
export function WebhookCard({ webhook, onDone }: { webhook?: Webhook; onDone?: () => void }) {
  const id = useId();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [events, setEvents] = useState(webhook?.events ?? ["identification.ready"]);
  const [secret, setSecret] = useState(webhook?.secret ?? "");

  const refresh = () => queryClient.invalidateQueries({ queryKey: webhooksQuery().queryKey });
  const save = useMutation(SpotarrService.method.saveWebhook, {
    onSuccess: async () => {
      await refresh();
      onDone?.();
    },
  });
  const test = useMutation(SpotarrService.method.testWebhook, { onSuccess: refresh });
  const remove = useMutation(SpotarrService.method.deleteWebhook, { onSuccess: refresh });
  const error = save.error ?? test.error ?? remove.error;

  function toggle(event: string) {
    if (events.includes(event)) setEvents(events.filter((e) => e !== event));
    else setEvents([...events, event]);
  }

  const delivery = webhook?.lastDelivery;
  const changed =
    !webhook ||
    url !== webhook.url ||
    secret !== webhook.secret ||
    events.join() !== webhook.events.join();

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label htmlFor={`${id}-url`} className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-medium">URL</span>
          <input
            id={`${id}-url`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            spellCheck={false}
            className={inputClass}
          />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Events</legend>
          {EVENTS.map(([event = "", label]) => (
            <label key={event} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={events.includes(event)}
                onChange={() => toggle(event)}
                className="accent-accent"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor={`${id}-secret`} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Secret (optional)</span>
          <input
            id={`${id}-secret`}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            spellCheck={false}
            className={inputClass}
          />
          <span className="text-sm text-text-muted">
            Signs each call: X-Spotarr-Signature is the body's HMAC-SHA256.
          </span>
        </label>
      </div>

      {delivery && (
        <p className={`text-sm ${delivery.ok ? "text-status-ok" : "text-status-error"}`}>
          Last call: {delivery.event} · {delivery.detail}
          {delivery.at && ` · ${timestampDate(delivery.at).toLocaleString()}`}
        </p>
      )}
      {error && <p className="text-sm text-status-error">{error.rawMessage}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={save.isPending || !changed}
          onClick={() => save.mutate({ webhook: { id: webhook?.id, url, events, secret } })}
          className={`${buttonClass} border-accent bg-accent text-accent-text`}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
        {webhook && (
          <button
            type="button"
            disabled={test.isPending || changed}
            onClick={() => test.mutate({ id: webhook.id })}
            className={buttonClass}
          >
            {test.isPending ? "Sending…" : "Send a test"}
          </button>
        )}
        {webhook ? (
          <button
            type="button"
            onClick={() => remove.mutate({ id: webhook.id })}
            className={`${buttonClass} text-status-error`}
          >
            Delete
          </button>
        ) : (
          <button type="button" onClick={onDone} className={buttonClass}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
