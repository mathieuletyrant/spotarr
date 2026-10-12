// Every error Spotarr expects carries one of these codes. Catch them all with
// `error instanceof SpotarrError`, then decide on `error.code`.
export type ErrorCode =
  | "unauthenticated" // missing or wrong API token
  | "invalid_input" // what the client sent is wrong
  | "not_found" // no such Share
  | "busy" // the Share is still being identified
  | "not_configured" // a setting is missing (a key, a model)
  | "unavailable" // a service failed or refused: TMDB, the LLM, yt-dlp…
  | "timeout"; // a service took too long

export class SpotarrError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SpotarrError";
  }
}
