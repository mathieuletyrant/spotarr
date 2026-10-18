import type { SyncCollectionResponse } from "@spotarr/contract";

// "1 title" or "2 titles".
function titles(count: number): string {
  return count === 1 ? "1 title" : `${count} titles`;
}

// What a sync did, in one line under the Sync now button:
// "3 titles in Spotted: 1 added, 2 removed. 4 watched, 1 not in Jellyfin yet."
export function describeSync(result: SyncCollectionResponse): string {
  let text = `${titles(result.titles)} in ${result.collection}`;
  if (result.added > 0 || result.removed > 0) {
    text += `: ${result.added} added, ${result.removed} removed`;
  } else {
    text += ", nothing to change";
  }
  const left: string[] = [];
  if (result.watched > 0) left.push(`${result.watched} watched`);
  if (result.notInJellyfin > 0) left.push(`${result.notInJellyfin} not in Jellyfin yet`);
  if (left.length > 0) text += `. ${left.join(", ")}`;
  return `${text}.`;
}
