const time = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// "Today", "Yesterday" or "Oct 10", then the time: "14:40".
export function shareDate(date: Date, now = new Date()): { day: string; time: string } {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.floor((startOfToday.getTime() - date.getTime()) / 86_400_000) + 1;
  const label = date >= startOfToday ? "Today" : daysAgo === 1 ? "Yesterday" : day.format(date);
  return { day: label, time: time.format(date) };
}

// 65.4 s → "1:05", the way a video player shows a time.
export function videoTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// 14 479 ms → "14 s".
export function seconds(ms: number): string {
  return `${Math.max(1, Math.round(ms / 1000))} s`;
}
