import { useState } from "react";
import { inputClass } from "./fields";

// The token the iPhone sends. Read-only here: Spotarr creates it at first start.
export function ApiTokenField({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <label htmlFor="api-token" className="text-sm font-medium">
        API token
      </label>
      <div className="flex gap-2">
        <input id="api-token" readOnly value={token} className={`${inputClass} font-mono`} />
        <button
          type="button"
          onClick={copy}
          className="h-10 shrink-0 rounded-md border border-border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="text-sm text-text-muted">
        Sent by the iPhone and scripts in the Authorization header.
      </span>
    </div>
  );
}
