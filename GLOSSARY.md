# Spotarr

Personal service that identifies the movie or TV show behind content shared from an iPhone, then adds it to the library once confirmed.

## Language

**Share**:
A piece of content sent to Spotarr (from the iPhone or the Share page) and everything that follows from it: its identification and its additions. One Share is one row of the history.
_Avoid_: submission, request, item

**Identification**:
The processing of a Share: extraction, candidate search, library check. A Share has exactly one Identification; retrying resets that same one.
_Avoid_: analysis, processing, job

**Input**:
What a Share contains when received: a URL, a text, an image, alone or combined.
_Avoid_: payload, content

**Source**:
Where the Input comes from, as displayed: domain and kind (`instagram.com/reel`, "Screenshot").
_Avoid_: origin

**Extractor**:
One way of pulling Clues out of an Input: ID page (regex on the URL), video (yt-dlp + ffmpeg), web page, image, text. Several can succeed on the same Share.
_Avoid_: sources used, parser, scraper

**Clues**:
What the Extractors pulled out of the Input: caption, author, subtitles, frames, direct IDs.
_Avoid_: metadata, hints, features

**Method**:
How the candidates were found: `DIRECT_ID` (an IMDb/TMDB ID found in the Clues, no LLM) or `LLM`.
_Avoid_: mode, strategy

**Candidate**:
A TMDB title proposed by the Identification, with a confidence and a Library state.
_Avoid_: result, match, suggestion

**Library state**:
What the library already knows of a Candidate: `ABSENT`, `REQUESTED`, `PARTIAL` (some seasons) or `AVAILABLE`. Only an `ABSENT` Candidate can be added.
_Avoid_: in_library, present, exists

**Addition**:
The request to add a Candidate to the library through a Target. A Share can have several Additions, one per chosen Candidate.
_Avoid_: request, download, order

**Target**:
Where an Addition goes: `ARR` (Radarr or Sonarr directly) or `SEERR`.
_Avoid_: destination, backend, service

**Identification status**:
The state of the Identification: `QUEUED`, `PROCESSING`, then `READY`, `NO_MATCH` or `FAILED`.
_Avoid_: state, progress

**Addition status**:
The state of an Addition: added, requested (Seerr), already present, failed.
_Avoid_: addition result

**Summary**:
The state of a Share as shown in the history. Derived, never stored: the Addition status when at least one Addition exists; otherwise the Identification status, where `READY` reads "already present" if the best Candidate is `AVAILABLE` or `PARTIAL`, "to choose" otherwise.
_Avoid_: status (alone), global status

**Dependency**:
A program or service Spotarr needs to identify and add: the LLM, TMDB, Seerr, yt-dlp, ffmpeg. Each one is OK, not configured, or in error with the reason.
_Avoid_: service, health, integration

**Event**:
Something a Share went through that outside services may react to: `identification.ready`, `identification.no_match`, `identification.failed`, `media.added`.
_Avoid_: notification, hook, trigger

**Webhook**:
A URL Spotarr calls with the full Event payload, chosen per Event. Spotarr knows nothing about what sits behind it.
_Avoid_: integration, notifier, Home Assistant
