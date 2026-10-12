import { Method, type Share, Summary } from "@spotarr/contract";
import { seconds, videoTime } from "../../lib/format";
import { Card } from "./card";

const EXTRACTORS: Record<string, string> = {
  video: "Video",
  "id-link": "IMDb or TMDB link",
  web: "Web page",
};

// What the extractors found in the shared content, and how it was identified.
export function CluesCard({ share }: { share: Share }) {
  const idf = share.identification;
  const clues = idf?.clues;
  const rows: [string, string | undefined][] = [
    ["Sources", idf?.extractors.map((e) => EXTRACTORS[e] ?? e).join(", ") || undefined],
    ["Caption", clues?.caption],
    ["Author", clues?.author],
    ["Method", methodOf(share)],
  ];

  return (
    <Card title="Clues">
      <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-text-muted">{label}</dt>
            <dd className={value ? "" : "text-text-muted"}>{value ?? "None"}</dd>
          </div>
        ))}
      </dl>
      {share.frames.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-text-muted">
            {share.frames.length} frames taken from the video
          </p>
          <ul className="grid grid-cols-6 gap-2">
            {share.frames.map((frame) => (
              <li key={frame.url} className="relative overflow-hidden rounded-md bg-surface">
                <img
                  src={frame.url}
                  alt={`Frame at ${videoTime(frame.atSeconds)}`}
                  loading="lazy"
                  className="aspect-9/16 w-full object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded-sm bg-bg/70 px-1 font-mono text-xs">
                  {videoTime(frame.atSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function methodOf(share: Share): string | undefined {
  const idf = share.identification;
  if (share.summary === Summary.IN_PROGRESS) return "Identifying…";
  if (!idf?.durationMs) return undefined;
  const duration = seconds(idf.durationMs);
  if (idf.method === Method.DIRECT_ID) return `Direct link · ${duration}`;
  if (idf.method === Method.LLM) return `LLM · ${duration}`;
  return duration;
}
