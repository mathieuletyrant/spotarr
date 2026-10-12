// Turns tokens.json into gen/tokens.css: one block of CSS variables for light
// (on :root) and one for dark (on .dark). Colors are the only themed tokens;
// everything else is emitted once, on :root. Swift output comes with the iOS app.
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
    const all = dictionary.allTokens;
    const light = all.filter((t) => t.path[1] !== "dark");
    const dark = all.filter((t) => t.path[0] === "color" && t.path[1] === "dark");
    return `/* Generated from tokens.json by build.ts. Do not edit. */\n${block(":root", light)}\n${block(".dark", dark)}`;
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
