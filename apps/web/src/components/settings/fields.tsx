import type { ReactNode } from "react";
import type { Values } from "../../lib/settings-form";

// What every field needs from the form: the values, the errors, and how to change one.
export type Form = {
  values: Values;
  errors: Values;
  change: (name: string, value: string) => void;
};

// One block of the page, reachable from the menu by its id.
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-border bg-surface-raised p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-text-muted">{description}</p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{children}</div>
    </section>
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

export const inputClass =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent";

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
