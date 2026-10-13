import type { ShareRepository } from "../repository";
import { type HistoryRequest, historyPage } from "../rules/history";

// One page of the history, newest first.
export async function listHistory(
  request: HistoryRequest,
  { shares }: { shares: ShareRepository },
) {
  return historyPage(await shares.all(), request);
}
