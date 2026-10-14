import { Copy, Eye, EyeOff } from "lucide-react";
import { type ReactNode, useState } from "react";
import { inputClass } from "./fields";

// A secret Spotarr made, read-only here: hidden until asked, copied in one
// click. `children` adds buttons after Copy (Regenerate).
export function TokenField({
  id,
  label,
  value,
  hint,
  children,
}: {
  id: string;
  label: string;
  value: string;
  hint: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        <span className="relative min-w-0 flex-1 basis-40">
          <input
            id={id}
            readOnly
            type={shown ? "text" : "password"}
            value={value}
            className={`${inputClass} pr-10 font-mono`}
          />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-label={shown ? `Hide the ${label}` : `Show the ${label}`}
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
        {children}
      </div>
      <span className="text-sm text-text-muted">{hint}</span>
    </div>
  );
}
