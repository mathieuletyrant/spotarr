// Turns tokens.json into gen/tokens.css, read by Tailwind v4: an @theme block
// (light colors and every other token, which become Tailwind utilities like
// bg-surface or rounded-md) and a .dark block that swaps the colors.
// Icons are names for the components, not CSS: they are left out here.
import StyleDictionary from "style-dictionary";
import type { TransformedToken } from "style-dictionary/types";

const THEMES = ["light", "dark"] as const;

// color.dark.status-added -> --color-status-added (the theme segment is dropped).
function cssName(token: TransformedToken): string {
  const path = token.path.filter((segment) => !THEMES.includes(segment as (typeof THEMES)[number]));
  return `--${path.join("-")}`;
}

function cssValue(token: TransformedToken): string {
  const value = token.$value;
  return Array.isArray(value)
    ? value.map((v) => (v.includes(" ") ? `"${v}"` : v)).join(", ")
    : String(value);
}

function block(selector: string, tokens: TransformedToken[]): string {
  const lines = tokens.map((t) => `  ${cssName(t)}: ${cssValue(t)};`);
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

StyleDictionary.registerFormat({
  name: "css/themed-variables",
  format: ({ dictionary }) => {
    const css = dictionary.allTokens.filter((t) => t.path[0] !== "icon");
    const light = css.filter((t) => t.path[1] !== "dark");
    const dark = css.filter((t) => t.path[0] === "color" && t.path[1] === "dark");
    return `/* Generated from tokens.json by build.ts. Do not edit. */\n${block("@theme", light)}\n${block(".dark", dark)}`;
  },
});

const sd = new StyleDictionary({
  usesDtcg: true,
  // Light and dark tokens share a CSS name on purpose (see cssName); SD flags that as a collision.
  log: { warnings: "disabled" },
  source: ["tokens.json"],
  platforms: {
    css: {
      buildPath: "gen/",
      files: [{ destination: "tokens.css", format: "css/themed-variables" }],
    },
  },
});

await sd.buildAllPlatforms();
