import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "system" | "light" | "dark";

const THEMES = [
  { theme: "system", label: "System", Icon: Monitor },
  { theme: "light", label: "Light", Icon: Sun },
  { theme: "dark", label: "Dark", Icon: Moon },
] as const;

// index.html defines it: it applies the saved theme, or the system's.
declare global {
  interface Window {
    applyTheme: () => void;
  }
}

function savedTheme(): Theme {
  try {
    const theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") return theme;
  } catch {
    // Storage blocked (private window): the system's theme then.
  }
  return "system";
}

// System, Light and Dark side by side; the current choice is pressed.
export function ThemeSwitch() {
  const [theme, setTheme] = useState(savedTheme);

  function choose(chosen: Theme) {
    try {
      localStorage.setItem("theme", chosen);
    } catch {
      // Storage blocked (private window): the page keeps the system's theme.
    }
    setTheme(chosen);
    window.applyTheme();
  }

  return (
    <fieldset className="flex rounded-md border border-border p-0.5">
      <legend className="sr-only">Theme</legend>
      {THEMES.map(({ theme: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={theme === option}
          title={label}
          className="flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs text-text-muted hover:text-text aria-pressed:bg-text/8 aria-pressed:text-text"
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </button>
      ))}
    </fieldset>
  );
}
