import { Eye, EyeOff, Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Values } from "../../lib/settings-form";

// What every field needs from the form: the values, the errors, and how to change one.
export type Form = {
  values: Values;
  errors: Values;
  change: (name: string, value: string) => void;
};

// One section of the page, shown by its tab: an amber icon, the
// title and what it is for, an optional ⓘ with more details, an optional
// button on the right, then the fields.
export function Section({
  id,
  icon,
  title,
  description,
  info,
  action,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  info?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="overflow-hidden rounded-xl border border-border bg-surface-raised">
      <div className="flex items-start gap-4 border-b border-divider p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold">{title}</h2>
            {info && <InfoBubble id={`${id}-info`} text={info} />}
          </div>
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        </div>
        {action}
      </div>
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

// A title over a group of fields in a Section, across its width. Every group
// but the first is set apart by a line above it.
export function SubHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-divider not-first:border-t not-first:pt-5 md:col-span-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
    </div>
  );
}

// An ⓘ button opening a small bubble under it. The browser's popover handles
// opening on click or tap, and closing on Escape or a click elsewhere.
function InfoBubble({ id, text }: { id: string; text: string }) {
  const anchor = `--${id}`;
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label="More about this"
        style={{ anchorName: anchor }}
        className="rounded-full text-text-muted hover:text-text"
      >
        <Info aria-hidden className="size-4" />
      </button>
      <div
        id={id}
        popover="auto"
        style={{ positionAnchor: anchor, top: "anchor(bottom)", left: "anchor(left)" }}
        className="m-0 mt-2 max-w-xs rounded-md border border-border bg-surface-raised p-3 text-sm text-text shadow-lg"
      >
        {text}
      </div>
    </>
  );
}

// A label, the input itself, then a hint or the server's error for this field.
export function Field({
  form,
  name,
  label,
  hint,
  wide,
  children,
}: {
  form: Form;
  name: string;
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const error = form.errors[name];
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the input comes in `children`, inside the label
    <label className={`flex flex-col gap-1.5 ${wide ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="text-sm text-status-error">{error}</span>}
      {!error && hint && <span className="text-sm text-text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass = "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm";

export function TextField({
  form,
  name,
  label,
  hint,
  placeholder,
  wide,
}: {
  form: Form;
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <Field form={form} name={name} label={label} hint={hint} wide={wide}>
      <input
        value={form.values[name] ?? ""}
        onChange={(e) => form.change(name, e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={inputClass}
      />
    </Field>
  );
}

// A key or token: hidden by default, shown with the eye. Still plain text
// underneath, as decided: the UI shows and copies secrets.
export function SecretField({
  form,
  name,
  label,
  placeholder,
  wide,
}: {
  form: Form;
  name: string;
  label: string;
  placeholder?: string;
  wide?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field form={form} name={name} label={label} wide={wide}>
      <span className="relative">
        <input
          type={shown ? "text" : "password"}
          value={form.values[name] ?? ""}
          onChange={(e) => form.change(name, e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className={`${inputClass} pr-10 font-mono`}
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? `Hide ${label}` : `Show ${label}`}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text"
        >
          {shown ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      </span>
    </Field>
  );
}
