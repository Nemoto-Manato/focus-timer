let scheduledTimeoutId = null;

export function isSupported() {
  return "Notification" in window;
}

export async function requestPermission() {
  if (!isSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Only fires reliably while this tab stays active/foregrounded — the browser
// can suspend timers once the tab is backgrounded or the screen locks. See
// technical design doc §3.1 for the full explanation of this constraint.
export function scheduleSessionEndNotification(afterSeconds) {
  cancelSessionEndNotification();
  if (!isSupported() || Notification.permission !== "granted") return;

  scheduledTimeoutId = setTimeout(() => {
    new Notification("Session complete", {
      body: "Nice work — time for a break.",
    });
  }, afterSeconds * 1000);
}

export function cancelSessionEndNotification() {
  if (scheduledTimeoutId !== null) {
    clearTimeout(scheduledTimeoutId);
    scheduledTimeoutId = null;
  }
}
