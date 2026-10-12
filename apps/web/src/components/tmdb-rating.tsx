const count = new Intl.NumberFormat("en-US");

// TMDB's logo and rating, "TMDB 7.8", with the number of votes beside it, or
// only on hover when compact. Nothing when TMDB has no votes for the title.
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
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm"
    >
      {/* TMDB's official short logo, as its attribution guidelines ask: unaltered. */}
      <img src="/tmdb.svg" alt="" className="h-2.5 w-auto" />
      <span className="sr-only">TMDB rating</span>
      <span className="font-medium">{score}</span>
      {!compact && voteText && <span className="text-text-muted">· {voteText}</span>}
    </span>
  );
}
