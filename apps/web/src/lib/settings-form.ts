import type { Settings } from "@spotarr/contract";

// The Settings form keeps every value as text, keyed by its path in the
// settings: "seerr.apiKey". The server's validation errors name the same paths.
export type Values = Record<string, string>;

const SECTIONS = ["identification", "seerr", "extraction", "webhooks", "access"] as const;
const NUMBERS = ["extraction.framesPerVideo", "extraction.maxVideoMb", "extraction.concurrency"];

export function toValues(settings: Settings): Values {
  const values: Values = {};
  for (const section of SECTIONS) {
    for (const [key, value] of Object.entries(settings[section] ?? {})) {
      if (key === "$typeName" || value === undefined) continue;
      values[`${section}.${key}`] = String(value);
    }
  }
  return values;
}

export function changedFields(values: Values, saved: Values): string[] {
  return Object.keys(values).filter((name) => values[name] !== saved[name]);
}

// Only the changed fields: UpdateSettings leaves the others as they are.
export function changes(values: Values, saved: Values) {
  const patch: Record<string, Record<string, string | number>> = {};
  for (const name of changedFields(values, saved)) {
    const [section = "", key = ""] = name.split(".");
    patch[section] ??= {};
    patch[section][key] = NUMBERS.includes(name) ? Number(values[name]) : (values[name] ?? "");
  }
  return patch;
}

// "seerr.url: Invalid URL; extraction.concurrency: Too big" becomes one
// message per field. A message without a path goes under "".
export function errorsByField(message: string): Values {
  const errors: Values = {};
  for (const part of message.split("; ")) {
    const [path, ...rest] = part.split(": ");
    if (path && rest.length > 0 && /^[a-z]+\.[a-zA-Z]+$/.test(path)) {
      errors[path] = rest.join(": ");
    } else {
      errors[""] = part;
    }
  }
  return errors;
}
