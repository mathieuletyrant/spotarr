import { Field, type Form } from "./fields";

// Auto add's three settings, and the rule they make, said in plain words.
export function AutoAddFields({ form }: { form: Form }) {
  const enabled = form.values["autoAdd.enabled"] === "true";
  const minConfidence = form.values["autoAdd.minConfidence"] ?? "95";
  const onlyOne = form.values["autoAdd.onlyOne"] !== "false";

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4 md:col-span-2">
        <span id="auto-add-label" className="font-medium">
          Add automatically when the identification is confident
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="auto-add-label"
          onClick={() => form.change("autoAdd.enabled", String(!enabled))}
          className="relative h-6 w-11 shrink-0 rounded-full bg-text/15 transition-colors aria-checked:bg-accent"
        >
          <span
            aria-hidden
            className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-bg shadow transition-transform ${enabled ? "translate-x-5" : ""}`}
          />
        </button>
      </div>

      <fieldset disabled={!enabled} className="contents">
        <Field
          form={form}
          name="autoAdd.minConfidence"
          label={`Minimum confidence: ${minConfidence} %`}
        >
          <input
            type="range"
            min={50}
            max={100}
            value={minConfidence}
            onChange={(e) => form.change("autoAdd.minConfidence", e.target.value)}
            className="h-10 accent-accent"
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">When there are several candidates</span>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={onlyOne}
              onChange={() => form.change("autoAdd.onlyOne", "true")}
              className="accent-accent"
            />
            Add nothing: I choose
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!onlyOne}
              onChange={() => form.change("autoAdd.onlyOne", "false")}
              className="accent-accent"
            />
            Add every one that reaches it
          </label>
        </div>
      </fieldset>

      <p className="rounded-md border border-border bg-surface p-3 text-sm md:col-span-2">
        {rule(enabled, minConfidence, onlyOne)}
      </p>
    </>
  );
}

function rule(enabled: boolean, minConfidence: string, onlyOne: boolean): string {
  if (!enabled) return "Off: you choose every candidate yourself, in the History.";
  const common =
    "A candidate already in your library is never requested again, a TV show gets season 1 only, and a link to IMDb or TMDB counts as 100 %.";
  if (onlyOne) {
    return `When the identification finds a single candidate, at ${minConfidence} % or more, Spotarr requests it through Seerr on its own. With two candidates or more, you choose. ${common}`;
  }
  return `Every candidate at ${minConfidence} % or more is requested through Seerr on its own: a reel naming three films can add all three. ${common}`;
}
