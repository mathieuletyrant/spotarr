import { create, toJsonString } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { WebhookEventSchema } from "@spotarr/contract";
import type { Candidate, Share } from "../../domain/shares/types";
import type { EventName } from "../../domain/webhooks/types";
import { candidateMessage } from "../messages";

// The JSON a Webhook receives, shaped by the contract's WebhookEvent. Its
// Candidates are the API's, Candidate status included.
export function eventBody(
  event: EventName,
  share: Share,
  webUiUrl: string,
  added?: Candidate,
): string {
  const message = create(WebhookEventSchema, {
    event,
    shareId: share.id,
    createdAt: timestampFromDate(new Date(share.createdAt)),
    shareUrl: webUiUrl ? `${webUiUrl.replace(/\/+$/, "")}/shares/${share.id}` : undefined,
    source: share.source,
    sharedUrl: share.input.url,
    candidates: share.candidates.map((candidate) => candidateMessage(candidate, share.additions)),
    error: share.identification.error,
    added: added ? candidateMessage(added, share.additions) : undefined,
  });
  return toJsonString(WebhookEventSchema, message);
}
