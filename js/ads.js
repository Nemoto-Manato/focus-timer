import { completedSessionCountToday, interstitialShownToday, markInterstitialShownToday } from "./storage.js";

// The only two entry points into ad rendering in this codebase. Per the
// screen design doc, ads are restricted to exactly two surfaces: an
// interstitial-style overlay on the Break Prompt (after the 3rd completed
// session/day, capped at 1/day) and a banner on the Stats screen. Do not
// call AdSense APIs from anywhere else.

// TODO(release): replace with the real AdSense publisher/slot IDs before
// launch. Left blank so ad calls are inert (no-op) during development.
const ADSENSE_CLIENT_ID = "";
const BANNER_SLOT_ID = "";
const INTERSTITIAL_SLOT_ID = "";

function adsConfigured() {
  return Boolean(ADSENSE_CLIENT_ID);
}

function renderAdUnit(container, slotId) {
  if (!adsConfigured() || !slotId) {
    container.textContent = "";
    return;
  }
  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.dataset.adClient = ADSENSE_CLIENT_ID;
  ins.dataset.adSlot = slotId;
  container.appendChild(ins);
  (window.adsbygoogle = window.adsbygoogle || []).push({});
}

/** Call only from the Stats screen. */
export function renderBannerAd(container) {
  renderAdUnit(container, BANNER_SLOT_ID);
}

/** Call only from the Break Prompt transition, never from Session Active. */
export function maybeShowInterstitialAfterBreakStart(overlayEl, adContainerEl) {
  const eligible = completedSessionCountToday() >= 3 && !interstitialShownToday();
  if (!eligible || !adsConfigured()) return;

  renderAdUnit(adContainerEl, INTERSTITIAL_SLOT_ID);
  overlayEl.hidden = false;
  markInterstitialShownToday();
}
