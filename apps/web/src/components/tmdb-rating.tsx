import { Star } from "lucide-react";

const count = new Intl.NumberFormat("en-US");

// TMDB's rating, "★ 7.8", with the number of votes beside it, or only on hover
// when compact. Nothing when TMDB has no votes for the title.
export function TmdbRating({
  rating,
  votes,
  compact = false,
}: {
  rating?: number;
  votes?: number;
  compact?: boolean;
}) {
  if (rating === undefined) return null;
  const score = rating.toFixed(1);
  const voteText = votes === undefined ? "" : `${count.format(votes)} votes`;
  return (
    <span
      title={`TMDB rating: ${score}/10${voteText && `, ${voteText}`}`}
      className="inline-flex items-center gap-1 whitespace-nowrap text-sm"
    >
      <Star aria-hidden className="size-3.5 fill-accent text-accent" />
      <span className="sr-only">TMDB rating</span>
      <span className="font-medium">{score}</span>
      {!compact && voteText && <span className="text-text-muted">· {voteText}</span>}
    </span>
  );
}
