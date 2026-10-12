import { type HistoryRequest, historyPage } from "../history";
import type { ShareRepository } from "../repository";

// One page of the history, newest first.
export async function listHistory(
  request: HistoryRequest,
  { shares }: { shares: ShareRepository },
) {
  return historyPage(await shares.all(), request);
}
