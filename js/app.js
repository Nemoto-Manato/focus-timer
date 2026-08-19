import { TimerSession, Phase } from "./timer.js";
import { createCountdownRing } from "./components/countdown-ring.js";
import * as notifications from "./notifications.js";
import * as ads from "./ads.js";
import { dailyStats } from "./stats.js";
import { isOnboardingComplete, setOnboardingComplete } from "./storage.js";

const SOUND_TRACKS = [
  { id: "rain", label: "Rain" },
  { id: "brownNoise", label: "Brown Noise" },
  { id: "cafe", label: "Cafe" },
  { id: "fan", label: "Fan" },
];

const soundLabel = (id) => SOUND_TRACKS.find((t) => t.id === id)?.label ?? id;

const session = new TimerSession();

const screens = {
  onboarding: document.getElementById("screen-onboarding"),
  home: document.getElementById("screen-home"),
  stats: document.getElementById("screen-stats"),
  sessionActive: document.getElementById("screen-session-active"),
  breakPrompt: document.getElementById("screen-break-prompt"),
  sessionComplete: document.getElementById("screen-session-complete"),
};

let activeTab = "home";

function showScreen(name) {
  for (const el of Object.values(screens)) el.hidden = true;
  screens[name].hidden = false;
}

function render() {
  if (!isOnboardingComplete()) {
    showScreen("onboarding");
    return;
  }

  switch (session.phase) {
    case Phase.IDLE:
      showScreen(activeTab === "stats" ? "stats" : "home");
      renderHome();
      if (activeTab === "stats") renderStats();
      break;
    case Phase.RUNNING:
      showScreen("sessionActive");
      renderSessionActive();
      break;
    case Phase.ON_BREAK:
      showScreen("breakPrompt");
      renderBreakPrompt();
      break;
    case Phase.COMPLETED_BREAK:
      showScreen("sessionComplete");
      renderSessionComplete();
      break;
  }
}

// --- Onboarding ---

function initOnboarding() {
  const container = document.getElementById("onboarding-sound-options");
  for (const track of SOUND_TRACKS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "sound-card";
    card.textContent = track.label;
    card.addEventListener("click", () => {
      const settings = session.settings;
      settings.lastUsedSound = track.id;
      session.updateSettings(settings);
      goToOnboardingStep(2);
    });
    container.appendChild(card);
  }

  document.querySelectorAll("#distraction-options .option-button").forEach((btn) => {
    btn.addEventListener("click", () => goToOnboardingStep(1));
  });

  document.getElementById("enable-notifications-btn").addEventListener("click", async () => {
    await notifications.requestPermission();
    finishOnboarding();
  });
  document.getElementById("skip-notifications-btn").addEventListener("click", finishOnboarding);
}

function goToOnboardingStep(step) {
  document.querySelectorAll(".onboarding-step").forEach((el) => {
    el.hidden = Number(el.dataset.step) !== step;
  });
}

function finishOnboarding() {
  setOnboardingComplete();
  render();
}

// --- Home ---

function renderHome() {
  document.getElementById("streak-label").textContent = `🔥 ${session.streak}日連続`;
  document.getElementById("start-duration-label").textContent = `${session.settings.workMinutes}:00`;
  document.getElementById("current-sound-label").textContent = soundLabel(session.settings.lastUsedSound);
}

function initHome() {
  document.getElementById("start-session-btn").addEventListener("click", () => session.startWork());

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  document.getElementById("open-sound-picker-btn").addEventListener("click", openSoundPicker);
  document.getElementById("open-session-setup-btn").addEventListener("click", openSessionSetup);
  document.getElementById("open-settings-btn").addEventListener("click", openSettings);
}

// --- Stats ---

function renderStats() {
  const list = document.getElementById("stats-list");
  list.innerHTML = "";
  for (const stat of dailyStats()) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${stat.dayKey}</span><span class="muted">${stat.sessionCount} sessions · ${stat.totalMinutes} min</span>`;
    list.appendChild(li);
  }
  ads.renderBannerAd(document.getElementById("stats-banner-ad"));
}

// --- Session Active ---

const ring = createCountdownRing();
document.getElementById("countdown-ring-container").appendChild(ring.element);

function renderSessionActive() {
  ring.update(session.remainingSeconds, session.settings.workMinutes * 60);
}

function initSessionActive() {
  document.getElementById("end-session-btn").addEventListener("click", () => session.endSessionEarly());
}

// --- Break Prompt ---

function renderBreakPrompt() {
  document.getElementById("break-headline").textContent = `お疲れさま、${session.settings.workMinutes}分完了。`;
  document.getElementById("break-streak-label").textContent = `🔥 ${session.streak}日連続`;

  const minutes = Math.floor(session.remainingSeconds / 60);
  const seconds = session.remainingSeconds % 60;
  document.getElementById(
    "break-countdown-label"
  ).textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} 休憩`;

  ads.maybeShowInterstitialAfterBreakStart(
    document.getElementById("ad-overlay"),
    document.getElementById("ad-overlay-container")
  );
}

function initBreakPrompt() {
  document.getElementById("skip-break-btn").addEventListener("click", () => {
    session.skipBreak();
    session.startWork();
  });

  document.getElementById("ad-overlay").addEventListener("click", (event) => {
    if (event.target.id === "ad-overlay") event.target.hidden = true;
  });
}

// --- Session Complete ---

function renderSessionComplete() {
  const todayMinutes = dailyStats().find((s) => s.dayKey === new Date().toISOString().slice(0, 10));
  const total = todayMinutes?.totalMinutes ?? 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  document.getElementById("complete-total-label").textContent =
    hours > 0 ? `今日は${hours}時間${minutes}分集中しました` : `今日は${minutes}分集中しました`;
  document.getElementById("complete-streak-label").textContent = `🔥 ${session.streak}日連続`;

  setTimeout(() => {
    if (session.phase === Phase.COMPLETED_BREAK) session.returnToIdle();
  }, 2500);
}

function initSessionComplete() {
  screens.sessionComplete.addEventListener("click", () => {
    if (session.phase === Phase.COMPLETED_BREAK) session.returnToIdle();
  });
}

// --- Sound picker dialog ---

function openSoundPicker() {
  const list = document.getElementById("sound-picker-list");
  list.innerHTML = "";
  for (const track of SOUND_TRACKS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `<span>${track.label}</span><span>${
      track.id === session.settings.lastUsedSound ? "✓" : ""
    }</span>`;
    btn.addEventListener("click", () => {
      const settings = session.settings;
      settings.lastUsedSound = track.id;
      session.updateSettings(settings);
      document.getElementById("sound-picker-dialog").close();
      render();
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
  document.getElementById("sound-picker-dialog").showModal();
}

// --- Session setup dialog ---

function openSessionSetup() {
  document.getElementById("setup-work-minutes").value = session.settings.workMinutes;
  document.getElementById("setup-break-minutes").value = session.settings.breakMinutes;
  document.getElementById("session-setup-dialog").showModal();
}

function initSessionSetup() {
  document.querySelectorAll(".preset-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("setup-work-minutes").value = btn.dataset.work;
      document.getElementById("setup-break-minutes").value = btn.dataset.break;
    });
  });

  document.getElementById("setup-start-btn").addEventListener("click", () => {
    const workMinutes = Number(document.getElementById("setup-work-minutes").value);
    const breakMinutes = Number(document.getElementById("setup-break-minutes").value);
    const settings = session.settings;
    settings.workMinutes = workMinutes;
    settings.breakMinutes = breakMinutes;
    session.updateSettings(settings);
    document.getElementById("session-setup-dialog").close();
    session.startWork(workMinutes * 60);
  });
}

// --- Settings dialog ---

function openSettings() {
  document.getElementById("settings-work-minutes").value = session.settings.workMinutes;
  document.getElementById("settings-break-minutes").value = session.settings.breakMinutes;
  document.getElementById("settings-volume").value = session.settings.volume;
  document.getElementById("settings-notifications-toggle").checked = session.settings.notificationsEnabled;
  document.getElementById("settings-dialog").showModal();
}

function initSettings() {
  document.getElementById("settings-done-btn").addEventListener("click", () => {
    session.updateSettings({
      ...session.settings,
      workMinutes: Number(document.getElementById("settings-work-minutes").value),
      breakMinutes: Number(document.getElementById("settings-break-minutes").value),
      volume: Number(document.getElementById("settings-volume").value),
      notificationsEnabled: document.getElementById("settings-notifications-toggle").checked,
    });
    document.getElementById("settings-dialog").close();
    render();
  });
}

function initDialogCloseButtons() {
  document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("dialog")?.close());
  });
}

// --- Boot ---

session.addEventListener("change", render);

initOnboarding();
initHome();
initSessionActive();
initBreakPrompt();
initSessionComplete();
initSessionSetup();
initSettings();
initDialogCloseButtons();

render();
