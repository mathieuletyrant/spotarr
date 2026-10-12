import { ffmpegVersion } from "../../../integrations/ffmpeg/version";
import { ping } from "../../../integrations/llm/client";
import { Seerr } from "../../../integrations/seerr/client";
import { Tmdb } from "../../../integrations/tmdb/client";
import { ytDlpVersion } from "../../../integrations/ytdlp/ytdlp";
import type { Settings } from "../schema";

export type Dependency = {
  name: "LLM" | "TMDB" | "Seerr" | "yt-dlp" | "ffmpeg";
  state: "OK" | "NOT_CONFIGURED" | "ERROR";
  detail: string;
};

// Calls every Dependency at once; one failing never hides the others.
export async function checkDependencies(settings: Settings): Promise<Dependency[]> {
  return Promise.all([
    checkLlm(settings),
    checkTmdb(settings),
    checkSeerr(settings),
    checkYtDlp(),
    checkFfmpeg(),
  ]);
}

async function checkLlm({ identification }: Settings): Promise<Dependency> {
  if (!identification.llmApiKey) {
    return { name: "LLM", state: "NOT_CONFIGURED", detail: "API key missing" };
  }
  try {
    await ping({
      apiUrl: identification.llmApiUrl,
      apiKey: identification.llmApiKey,
      model: identification.model,
    });
    return { name: "LLM", state: "OK", detail: identification.model };
  } catch (error) {
    return { name: "LLM", state: "ERROR", detail: reason(error) };
  }
}

async function checkTmdb({ identification }: Settings): Promise<Dependency> {
  if (!identification.tmdbToken) {
    return { name: "TMDB", state: "NOT_CONFIGURED", detail: "token missing" };
  }
  try {
    // Any read proves the token works; 550 is Fight Club.
    const tmdb = new Tmdb({ token: identification.tmdbToken, language: identification.language });
    await tmdb.movie(550);
    return { name: "TMDB", state: "OK", detail: identification.language };
  } catch (error) {
    return { name: "TMDB", state: "ERROR", detail: reason(error) };
  }
}

async function checkSeerr({ seerr }: Settings): Promise<Dependency> {
  if (!seerr.url || !seerr.apiKey) {
    return { name: "Seerr", state: "NOT_CONFIGURED", detail: "URL or API key missing" };
  }
  try {
    // Every Seerr route but /status needs the key: a movie lookup proves it works.
    await new Seerr({ url: seerr.url, apiKey: seerr.apiKey }).libraryState("MOVIE", 550);
    return { name: "Seerr", state: "OK", detail: seerr.url };
  } catch (error) {
    return { name: "Seerr", state: "ERROR", detail: reason(error) };
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
