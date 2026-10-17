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

**Effort**:
How long the LLM thinks before answering: `low` (the default), `medium` or `high`. Higher is slower and dearer. Spotarr waits up to 60 s, 3 min or 5 min. Set in Settings; Retry can ask for another, for that Identification only.
_Avoid_: reasoning level, thinking budget, mode

**Hint**:
One sentence given with a Retry for the LLM, saying what the Identification got wrong ("the Korean show, not the movie"). For that Identification only; unused when an IMDb or TMDB link answers.
_Avoid_: comment, note, prompt

**Candidate**:
A TMDB title proposed by the Identification, with a confidence and a Library state.
_Avoid_: result, match, suggestion

**Genre**:
A Candidate's TMDB genre, in the settings' language ("Horreur", "Science-Fiction"). The History filters by it: a Share matches when one of its Candidates has it.
_Avoid_: theme, category, tag

**Overview**:
A Candidate's TMDB synopsis, in the settings' language; none when TMDB has none in it. Kept for the MCP client, so Claude can judge a title it does not know.
_Avoid_: description, summary, plot

**MCP token**:
The read-only token MCP clients (an AI assistant like Claude) give in `/mcp?token=…`. It only lists Shares; the API token keeps every other right, and each is refused where the other belongs.
_Avoid_: read token, API key

**Seerr token**:
The token Seerr gives when it notifies Spotarr that a title changed in the library. It only reports changes; the API token and the MCP token are refused there, and it is refused everywhere else.
_Avoid_: webhook secret, Seerr key

**Rule**:
When auto add requests a Candidate without a click: a name, an on/off switch, and conditions that must all hold (type, a single Candidate, minimum confidence, minimum TMDB rating and votes). A title not out yet has no rating: a Rule may let it skip the rating and votes. A Candidate is added when one enabled Rule holds for it, credited to the first one; the Addition keeps the Rule's name.
_Avoid_: filter, automation, policy

**Library state**:
What the library knows of a Candidate: `ABSENT`, `REQUESTED`, `PARTIAL` (some seasons) or `AVAILABLE`. Checked at the Identification, then kept current as Seerr reports changes. Only an `ABSENT` Candidate can be added.
_Avoid_: in_library, present, exists

**Candidate status**:
Where a Candidate stands. Derived, never stored, from its Library state whatever path led there: "available" when `AVAILABLE` or `PARTIAL`, "requested" when `REQUESTED`, else "can add" (with the latest failed Addition's error, if any). A request Seerr declined, or a title deleted from the library, reads "can add" again.
_Avoid_: candidate state, action

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
What happened when the Addition was made: added, requested (Seerr), already present, failed. Kept as it was; what the library holds now is the Candidate status.
_Avoid_: addition result

**Summary**:
The state of a Share as shown in the history. Derived, never stored: "failed" when its latest Addition failed; the Candidate status of its latest Addition's Candidate when one exists; otherwise the Identification status, where `READY` reads "available" if the best Candidate is `AVAILABLE` or `PARTIAL`, "to choose" otherwise.
_Avoid_: status (alone), global status

**Collection**:
The Jellyfin collection Spotarr keeps of the titles added from a Share (an Addition that did not fail) that Jellyfin has and the user has not watched yet. Spotarr owns it: a title put in it by hand goes at the next sync. Synced every 15 minutes, when Seerr reports a title available, and on demand.
_Avoid_: list, playlist, watchlist

**Dependency**:
A program or service Spotarr needs to identify and add: the LLM, TMDB, Seerr, yt-dlp, ffmpeg; and Jellyfin, optional, once its URL is set. Each one is OK, not configured, or in error with the reason.
_Avoid_: service, health, integration

**Event**:
Something a Share went through that outside services may react to: `identification.ready`, `identification.no_match`, `identification.failed`, `media.added`.
_Avoid_: notification, hook, trigger

**Webhook**:
A URL Spotarr calls with the full Event payload, chosen per Event. Spotarr knows nothing about what sits behind it.
_Avoid_: integration, notifier
