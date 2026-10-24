// Poster sizes, all 2:3 like TMDB's: small in stacks, medium in the History,
// hero for a Share's best match.
const SIZES = {
  small: "h-12 w-8 text-sm",
  medium: "h-21 w-14 text-lg",
  hero: "h-36 w-24 text-3xl md:h-48 md:w-32",
};

// A TMDB poster, or the title's first letter while there is none.
export function Poster({
  title,
  url,
  size: sizeName = "medium",
}: {
  title: string;
  url?: string;
  size?: keyof typeof SIZES;
}) {
  const size = SIZES[sizeName];
  if (url) {
    // TMDB sends 500 px wide posters; 185 px is plenty for a thumbnail.
    return (
      <img
        src={url.replace("/w500/", "/w185/")}
        alt=""
        loading="lazy"
        className={`${size} shrink-0 rounded-md bg-surface object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-md border border-border bg-surface font-semibold text-text-muted`}
    >
      {title.charAt(0)}
    </div>
  );
}
