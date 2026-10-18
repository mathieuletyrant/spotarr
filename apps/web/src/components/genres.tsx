// A title's TMDB genres, as small labels: "Horreur", "Science-Fiction".
export function Genres({ genres }: { genres: string[] }) {
  if (genres.length === 0) return null;
  return (
    <ul aria-label="Genres" className="flex flex-wrap gap-1">
      {genres.map((genre) => (
        <li
          key={genre}
          className="rounded-full bg-text/8 px-2 py-0.5 text-xs whitespace-nowrap text-text-muted"
        >
          {genre}
        </li>
      ))}
    </ul>
  );
}
