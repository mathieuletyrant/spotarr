// Writes Spotarr.shortcut, the iOS Shortcut that sends a shared link to
// Spotarr, and signs it so an iPhone can import it. Needs macOS (the
// `shortcuts` and `plutil` commands). Run: bun shortcuts/build.ts
//
// A Shortcut is a property list of actions. It holds no secret: once imported,
// paste the API token into its second action, and the Cloudflare Access
// service token into the third and fourth when going through Cloudflare (iOS "import questions" left the
// Set Up button doing nothing on the iPhone, so there are none).
import { $ } from "bun";

const ADDRESS = "address";
const TOKEN = "token";
const CF_ID = "cf-id";
const CF_SECRET = "cf-secret";
const SEND = "send";

// A text made of plain parts and the outputs of earlier actions.
// Shortcuts marks each output with U+FFFC and says, by position, which one it is.
type Part = string | { output: string; name: string } | "input";

function text(...parts: Part[]) {
  let string = "";
  const attachmentsByRange: Record<string, object> = {};
  for (const part of parts) {
    if (typeof part === "string" && part !== "input") {
      string += part;
      continue;
    }
    const position = `{${string.length}, 1}`;
    attachmentsByRange[position] =
      part === "input"
        ? { Type: "ExtensionInput" }
        : { Type: "ActionOutput", OutputUUID: part.output, OutputName: part.name };
    string += "￼";
  }
  return { Value: { string, attachmentsByRange }, WFSerializationType: "WFTextTokenString" };
}

function dictionary(entries: [string, ReturnType<typeof text>][]) {
  return {
    Value: {
      WFDictionaryFieldValueItems: entries.map(([key, value]) => ({
        WFItemType: 0,
        WFKey: text(key),
        WFValue: value,
      })),
    },
    WFSerializationType: "WFDictionaryFieldValue",
  };
}

function output(uuid: string, name: string) {
  return {
    Value: { Type: "ActionOutput", OutputUUID: uuid, OutputName: name },
    WFSerializationType: "WFTextTokenAttachment",
  };
}

function action(identifier: string, parameters: object) {
  return {
    WFWorkflowActionIdentifier: `is.workflow.actions.${identifier}`,
    WFWorkflowActionParameters: parameters,
  };
}

const actions = [
  // 0 to 3: edited once after import. The Cloudflare Access service token
  // (client id and secret) is only needed when the address goes through
  // Cloudflare; empty, the headers are sent empty and Spotarr ignores them.
  action("gettext", { UUID: ADDRESS, WFTextActionText: text("http://umbrel.local:3838") }),
  action("gettext", { UUID: TOKEN, WFTextActionText: text("PASTE-YOUR-API-TOKEN-HERE") }),
  action("gettext", { UUID: CF_ID, WFTextActionText: text("") }),
  action("gettext", { UUID: CF_SECRET, WFTextActionText: text("") }),
  // 4: CreateShare, as plain JSON over HTTP.
  action("downloadurl", {
    UUID: SEND,
    WFURL: text({ output: ADDRESS, name: "Text" }, "/api/spotarr.v1.SpotarrService/CreateShare"),
    WFHTTPMethod: "POST",
    ShowHeaders: true,
    WFHTTPHeaders: dictionary([
      ["Authorization", text("Bearer ", { output: TOKEN, name: "Text" })],
      ["CF-Access-Client-Id", text({ output: CF_ID, name: "Text" })],
      ["CF-Access-Client-Secret", text({ output: CF_SECRET, name: "Text" })],
    ]),
    WFHTTPBodyType: "JSON",
    WFJSONValues: dictionary([["url", text("input")]]),
  }),
  // 5 to 9: a created Share comes back as {"share": …}. Anything else is
  // Spotarr's error ({"code", "message"}) or Cloudflare's page: show it.
  action("conditional", {
    GroupingIdentifier: "ifSent",
    WFControlFlowMode: 0,
    WFCondition: 99, // "contains"
    WFConditionalActionString: text('"share"'),
    WFInput: { Type: "Variable", Variable: output(SEND, "Contents of URL") },
  }),
  action("notification", {
    WFNotificationActionTitle: "Sent to Spotarr",
    WFNotificationActionBody: text("input"),
    WFNotificationActionSound: false,
  }),
  action("conditional", { GroupingIdentifier: "ifSent", WFControlFlowMode: 1 }),
  action("notification", {
    WFNotificationActionTitle: "Not sent to Spotarr",
    WFNotificationActionBody: text({ output: SEND, name: "Contents of URL" }),
  }),
  action("conditional", { GroupingIdentifier: "ifSent", WFControlFlowMode: 2 }),
];

const shortcut = {
  WFWorkflowClientVersion: "2605.0.5",
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: "900",
  WFWorkflowIcon: { WFWorkflowIconStartColor: 4282601983, WFWorkflowIconGlyphNumber: 61440 },
  // In the share sheet, for links only.
  WFWorkflowTypes: ["ActionExtension"],
  WFWorkflowInputContentItemClasses: ["WFURLContentItem"],
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowActions: actions,
};

const dir = import.meta.dir;
await Bun.write(`${dir}/Spotarr.json`, JSON.stringify(shortcut, null, 2));
await $`plutil -convert binary1 -o ${dir}/Spotarr-unsigned.shortcut ${dir}/Spotarr.json`;
await $`shortcuts sign --mode anyone --input ${dir}/Spotarr-unsigned.shortcut --output ${dir}/Spotarr.shortcut`;
await $`rm ${dir}/Spotarr.json ${dir}/Spotarr-unsigned.shortcut`;
console.log("shortcuts/Spotarr.shortcut written and signed");
