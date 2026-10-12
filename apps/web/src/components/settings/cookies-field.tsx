import { type ChangeEvent, useId } from "react";
import type { Form } from "./fields";

const NAME = "extraction.cookiesTxt";

// yt-dlp's cookies.txt: imported from a file rather than typed, since it is long.
export function CookiesField({ form }: { form: Form }) {
  const id = useId();
  const cookies = form.values[NAME] ?? "";
  const lines = cookies.split("\n").filter((line) => line && !line.startsWith("#")).length;

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) form.change(NAME, await file.text());
    event.target.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <span className="text-sm font-medium">Cookies for yt-dlp</span>
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          {cookies
            ? `cookies.txt set, ${lines} cookies.`
            : "No file. Public reels work without one; for private ones, export a cookies.txt from a logged-in browser, ideally a secondary account."}
        </p>
        <div className="flex shrink-0 gap-2">
          {cookies && (
            <button
              type="button"
              onClick={() => form.change(NAME, "")}
              className="h-9 rounded-md border border-border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent"
            >
              Remove
            </button>
          )}
          <label
            htmlFor={id}
            className="flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            Import cookies.txt
            <input
              id={id}
              type="file"
              accept=".txt,text/plain"
              onChange={importFile}
              className="sr-only"
            />
          </label>
        </div>
      </div>
      {form.errors[NAME] && <span className="text-sm text-status-error">{form.errors[NAME]}</span>}
    </div>
  );
}
