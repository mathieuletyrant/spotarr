import { createHmac } from "node:crypto";

// POSTs a JSON body to a Webhook's URL, signed when a secret is set. Never
// throws: says whether it worked, and what happened.
export async function postWebhook(
  url: string,
  body: string,
  secret: string,
): Promise<{ ok: boolean; detail: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["X-Spotarr-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { ok: false, detail: "no answer in 10 s" };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: `could not be reached: ${reason}` };
  }
}
