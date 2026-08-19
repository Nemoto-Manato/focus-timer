import { loadHistory } from "./storage.js";

export function dailyStats() {
  const records = loadHistory().filter((r) => r.completed);
  const grouped = new Map();

  for (const record of records) {
    const key = new Date(record.timestamp).toISOString().slice(0, 10);
    const existing = grouped.get(key) ?? { dayKey: key, sessionCount: 0, totalMinutes: 0 };
    existing.sessionCount += 1;
    existing.totalMinutes += record.durationMinutes;
    grouped.set(key, existing);
  }

  return [...grouped.values()].sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1));
}
