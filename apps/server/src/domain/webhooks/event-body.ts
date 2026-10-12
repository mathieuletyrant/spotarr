import { create, toJsonString } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { LibraryState, MediaType, WebhookEventSchema } from "@spotarr/contract";
import type { Candidate, Share } from "../shares/types";
import type { EventName } from "./types";

// The JSON a Webhook receives, shaped by the contract's WebhookEvent.
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
    candidates: share.candidates.map(candidateMessage),
    error: share.identification.error,
    added: added ? candidateMessage(added) : undefined,
  });
  return toJsonString(WebhookEventSchema, message);
}

function candidateMessage(candidate: Candidate) {
  return {
    ...candidate,
    type: MediaType[candidate.type],
    libraryState: LibraryState[candidate.libraryState],
  };
}
