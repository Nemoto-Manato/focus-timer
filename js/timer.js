import * as audio from "./audio.js";
import * as notifications from "./notifications.js";
import { loadSettings, saveSettings, appendSessionRecord, completedSessionCountToday, currentStreak } from "./storage.js";

export const Phase = {
  IDLE: "idle",
  RUNNING: "running",
  ON_BREAK: "onBreak",
  COMPLETED_BREAK: "completedBreak",
};

export class TimerSession extends EventTarget {
  constructor() {
    super();
    this.settings = loadSettings();
    this.phase = Phase.IDLE;
    this.remainingSeconds = 0;
    this.todaySessionCount = completedSessionCountToday();
    this.streak = currentStreak();

    this._phaseEndAt = null;
    this._configuredWorkSeconds = 0;
    this._intervalId = null;

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this._reconcile();
    });
  }

  _emit() {
    this.dispatchEvent(new CustomEvent("change"));
  }

  startWork(durationSeconds) {
    this._configuredWorkSeconds = durationSeconds ?? this.settings.workMinutes * 60;
    this.remainingSeconds = this._configuredWorkSeconds;
    this._phaseEndAt = Date.now() + this._configuredWorkSeconds * 1000;
    this.phase = Phase.RUNNING;

    audio.play(this.settings.lastUsedSound, this.settings.volume);
    if (this.settings.notificationsEnabled) {
      notifications.scheduleSessionEndNotification(this._configuredWorkSeconds);
    }
    this._startTicking();
    this._emit();
  }

  endSessionEarly() {
    this._stopTicking();
    audio.stop();
    notifications.cancelSessionEndNotification();
    appendSessionRecord({
      timestamp: Date.now(),
      durationMinutes: this.settings.workMinutes,
      completed: false,
    });
    this.phase = Phase.IDLE;
    this._emit();
  }

  skipBreak() {
    this._completeBreak();
  }

  returnToIdle() {
    this.phase = Phase.IDLE;
    this.remainingSeconds = 0;
    this._phaseEndAt = null;
    this._emit();
  }

  updateSettings(newSettings) {
    this.settings = newSettings;
    saveSettings(newSettings);
    this._emit();
  }

  _startTicking() {
    this._stopTicking();
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  _stopTicking() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _reconcile() {
    if (this.phase === Phase.RUNNING || this.phase === Phase.ON_BREAK) this._tick();
  }

  _tick() {
    if (!this._phaseEndAt) return;
    const remaining = Math.ceil((this._phaseEndAt - Date.now()) / 1000);
    this.remainingSeconds = Math.max(remaining, 0);
    this._emit();

    if (remaining <= 0) {
      if (this.phase === Phase.RUNNING) this._completeWork();
      else if (this.phase === Phase.ON_BREAK) this._completeBreak();
    }
  }

  _completeWork() {
    this._stopTicking();
    audio.stop();
    appendSessionRecord({
      timestamp: Date.now(),
      durationMinutes: Math.round(this._configuredWorkSeconds / 60),
      completed: true,
    });
    this.todaySessionCount = completedSessionCountToday();
    this.streak = currentStreak();
    this._startBreak();
  }

  _startBreak() {
    const breakSeconds = this.settings.breakMinutes * 60;
    this.remainingSeconds = breakSeconds;
    this._phaseEndAt = Date.now() + breakSeconds * 1000;
    this.phase = Phase.ON_BREAK;
    this._startTicking();
    this._emit();
  }

  _completeBreak() {
    this._stopTicking();
    this.phase = Phase.COMPLETED_BREAK;
    this._emit();
  }
}
