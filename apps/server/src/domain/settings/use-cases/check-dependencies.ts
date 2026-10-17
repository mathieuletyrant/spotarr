import { ffmpegVersion } from "../../../integrations/ffmpeg/version";
import { ping } from "../../../integrations/llm/client";
import { ytDlpVersion } from "../../../integrations/ytdlp/ytdlp";
import { jellyfinFrom, llmConfigFrom, seerrFrom, tmdbFrom } from "../adapters";
import type { Settings } from "../schema";

export type Dependency = {
  name: "LLM" | "TMDB" | "Seerr" | "yt-dlp" | "ffmpeg" | "Jellyfin";
  state: "OK" | "NOT_CONFIGURED" | "ERROR";
  detail: string;
};

// Calls every Dependency at once; one failing never hides the others.
// Jellyfin is optional: listed only once its URL is set.
export async function checkDependencies(settings: Settings): Promise<Dependency[]> {
  const checks = [
    checkLlm(settings),
    checkTmdb(settings),
    checkSeerr(settings),
    checkYtDlp(),
    checkFfmpeg(),
  ];
  if (settings.jellyfin.url) checks.push(checkJellyfin(settings));
  return Promise.all(checks);
}

async function checkLlm(settings: Settings): Promise<Dependency> {
  const { identification } = settings;
  if (!identification.llmApiKey) {
    return { name: "LLM", state: "NOT_CONFIGURED", detail: "API key missing" };
  }
  try {
    await ping(llmConfigFrom(settings));
    return { name: "LLM", state: "OK", detail: identification.model };
  } catch (error) {
    return { name: "LLM", state: "ERROR", detail: reason(error) };
  }
}

async function checkTmdb(settings: Settings): Promise<Dependency> {
  const { identification } = settings;
  if (!identification.tmdbToken) {
    return { name: "TMDB", state: "NOT_CONFIGURED", detail: "token missing" };
  }
  try {
    // Any read proves the token works; 550 is Fight Club.
    await tmdbFrom(settings).movie(550);
    return { name: "TMDB", state: "OK", detail: identification.language };
  } catch (error) {
    return { name: "TMDB", state: "ERROR", detail: reason(error) };
  }
}

async function checkSeerr(settings: Settings): Promise<Dependency> {
  const { seerr } = settings;
  if (!seerr.url || !seerr.apiKey) {
    return { name: "Seerr", state: "NOT_CONFIGURED", detail: "URL or API key missing" };
  }
  try {
    // Every Seerr route but /status needs the key: a movie lookup proves it works.
    await seerrFrom(settings).libraryState("MOVIE", 550);
    return { name: "Seerr", state: "OK", detail: seerr.url };
  } catch (error) {
    return { name: "Seerr", state: "ERROR", detail: reason(error) };
  }
}

async function checkJellyfin(settings: Settings): Promise<Dependency> {
  const { jellyfin } = settings;
  if (!jellyfin.apiKey || !jellyfin.user) {
    return { name: "Jellyfin", state: "NOT_CONFIGURED", detail: "API key or user missing" };
  }
  try {
    // The version proves the key works; the user must exist for "watched".
    const client = jellyfinFrom(settings);
    const version = await client.version();
    await client.userId(jellyfin.user);
    return { name: "Jellyfin", state: "OK", detail: `${version}, ${jellyfin.user}` };
  } catch (error) {
    return { name: "Jellyfin", state: "ERROR", detail: reason(error) };
  }
}

async function checkYtDlp(): Promise<Dependency> {
  try {
    return { name: "yt-dlp", state: "OK", detail: await ytDlpVersion() };
  } catch (error) {
    return { name: "yt-dlp", state: "ERROR", detail: reason(error) };
  }
}

async function checkFfmpeg(): Promise<Dependency> {
  try {
    return { name: "ffmpeg", state: "OK", detail: await ffmpegVersion() };
  } catch (error) {
    return { name: "ffmpeg", state: "ERROR", detail: reason(error) };
  }
}

function reason(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
