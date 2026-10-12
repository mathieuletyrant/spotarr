import type { Share } from "@spotarr/contract";
import { Clapperboard, Globe, Image, Type } from "lucide-react";

const VIDEO_SITES = [
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
];

// What kind of thing was shared: a video, a web page, an image or a text.
export function SourceIcon({ share }: { share: Share }) {
  const props = { "aria-hidden": true, className: "size-4 shrink-0 text-text-muted" };
  if (share.input?.hasImage) return <Image {...props} />;
  if (!share.input?.url) return <Type {...props} />;
  if (VIDEO_SITES.includes(share.source)) return <Clapperboard {...props} />;
  return <Globe {...props} />;
}
