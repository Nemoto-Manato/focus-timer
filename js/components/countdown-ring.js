const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function createCountdownRing() {
  const wrapper = document.createElement("div");
  wrapper.className = "countdown-ring";
  wrapper.innerHTML = `
    <svg viewBox="0 0 260 260" width="260" height="260" role="img" aria-label="残り時間">
      <circle class="ring-track" cx="130" cy="130" r="${RADIUS}" />
      <circle class="ring-progress" cx="130" cy="130" r="${RADIUS}"
        stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" />
    </svg>
    <div class="ring-label" aria-hidden="true">00:00</div>
  `;

  const progressCircle = wrapper.querySelector(".ring-progress");
  const label = wrapper.querySelector(".ring-label");
  const svg = wrapper.querySelector("svg");

  function update(remainingSeconds, totalSeconds) {
    const progress = totalSeconds > 0 ? 1 - remainingSeconds / totalSeconds : 0;
    progressCircle.setAttribute("stroke-dashoffset", String(CIRCUMFERENCE * (1 - progress)));

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const text = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    label.textContent = text;
    svg.setAttribute("aria-label", `残り${minutes}分${seconds}秒`);
  }

  return { element: wrapper, update };
}
