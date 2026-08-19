const SETTINGS_KEY = "focustimer.settings";
const HISTORY_KEY = "focustimer.history";
const ONBOARDING_KEY = "focustimer.onboardingComplete";
const INTERSTITIAL_SHOWN_KEY = "focustimer.interstitial.lastShownDay";
const MAX_HISTORY_DAYS = 30;

const defaultSettings = () => ({
  workMinutes: 25,
  breakMinutes: 5,
  volume: 0.8,
  notificationsEnabled: true,
  lastUsedSound: "rain",
});

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function appendSessionRecord(record) {
  const history = loadHistory();
  history.push(record);

  const cutoff = Date.now() - MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const trimmed = history.filter((r) => r.timestamp >= cutoff);

  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function completedSessionCountToday() {
  const today = dayKey(Date.now());
  return loadHistory().filter((r) => r.completed && dayKey(r.timestamp) === today).length;
}

export function currentStreak() {
  const completedDays = new Set(
    loadHistory()
      .filter((r) => r.completed)
      .map((r) => dayKey(r.timestamp))
  );
  if (completedDays.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  while (completedDays.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function isOnboardingComplete() {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function setOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, "true");
}

export function interstitialShownToday() {
  return localStorage.getItem(INTERSTITIAL_SHOWN_KEY) === dayKey(Date.now());
}

export function markInterstitialShownToday() {
  localStorage.setItem(INTERSTITIAL_SHOWN_KEY, dayKey(Date.now()));
}
