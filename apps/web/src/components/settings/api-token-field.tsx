import { Copy, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { inputClass } from "./fields";

// The token the iPhone sends. Read-only here: Spotarr creates it at first start.
export function ApiTokenField({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);

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
        <span className="relative flex-1">
          <input
            id="api-token"
            readOnly
            type={shown ? "text" : "password"}
            value={token}
            className={`${inputClass} pr-10 font-mono`}
          />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-label={shown ? "Hide the API token" : "Show the API token"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text"
          >
            {shown ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-surface"
        >
          <Copy aria-hidden className="size-4" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="text-sm text-text-muted">
        Sent by the iPhone and scripts in the Authorization header.
      </span>
    </div>
  );
}
