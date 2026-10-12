import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

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

// Cycles System → Light → Dark. The icon shows the current choice.
export function ThemeButton() {
  const [theme, setTheme] = useState(savedTheme);

  function next() {
    const chosen = NEXT[theme];
    try {
      localStorage.setItem("theme", chosen);
    } catch {
      // Storage blocked (private window): the page keeps the system's theme.
    }
    setTheme(chosen);
    window.applyTheme();
  }

  const label = `Theme: ${LABELS[theme]}`;
  return (
    <button
      type="button"
      onClick={next}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-text/8 hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
    >
      {theme === "system" && <Monitor aria-hidden className="size-4" />}
      {theme === "light" && <Sun aria-hidden className="size-4" />}
      {theme === "dark" && <Moon aria-hidden className="size-4" />}
    </button>
  );
}
