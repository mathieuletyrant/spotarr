import type { ShareRepository } from "../repository";
import { countByKeyword } from "../rules/history";

// Every keyword of the history's Candidates, with how many Shares have it,
// most Shares first: the names the History's keyword filter accepts.
export async function listKeywords({ shares }: { shares: ShareRepository }) {
  return countByKeyword(await shares.all());
}
