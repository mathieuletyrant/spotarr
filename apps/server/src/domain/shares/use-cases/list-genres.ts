import type { ShareRepository } from "../repository";
import { countByGenre } from "../rules/history";

// Every genre of the history's Candidates, with how many Shares have it, most
// Shares first: the names the History's genre filter accepts.
export async function listGenres({ shares }: { shares: ShareRepository }) {
  return countByGenre(await shares.all());
}
