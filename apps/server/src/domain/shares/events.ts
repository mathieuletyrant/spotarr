import type { Candidate, Share } from "./types";

// The glossary's Events: what a Share went through that outside services may
// react to. The domain only says what happened; whoever listens (the Webhooks)
// decides what to do with it.
export type Event =
  | { name: IdentificationEventName; share: Share }
  | { name: "media.added"; share: Share; added: Candidate };

// How an Identification ended.
export type IdentificationEventName =
  | "identification.ready"
  | "identification.no_match"
  | "identification.failed";

export type Emit = (event: Event) => Promise<void>;
