import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { webhooksQuery } from "../../queries/settings";
import { WebhookCard } from "./webhook-card";

// Every Webhook, then a new one being added, or the button to add one.
export function WebhooksList() {
  const { data } = useQuery(webhooksQuery());
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3 md:col-span-2">
      {data?.webhooks.map((webhook) => (
        <WebhookCard key={webhook.id} webhook={webhook} />
      ))}
      {adding ? (
        <WebhookCard onDone={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-9 w-fit rounded-md border border-border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
        >
          Add a webhook
        </button>
      )}
    </div>
  );
}
