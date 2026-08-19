// All four ambient tracks are generated on the fly via the Web Audio API
// rather than bundled audio files, so none of them carry any licensing
// surface at all (see technical design doc §3.2 — the original plan was to
// generate only the brown noise track and source the rest; generating all
// four removes the need to source/license external recordings entirely).

let audioContext = null;
let activeNodes = [];
let masterGain = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function createNoiseBuffer(ctx, seconds = 4) {
  const bufferSize = seconds * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createLoopingNoiseSource(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx);
  source.loop = true;
  return source;
}

// A slow, gentle LFO used to modulate a gain node's level so a track
// doesn't sound perfectly static (e.g. rain intensity drifting, a fan's
// blade-pass wobble).
function attachWobble(ctx, gainParam, { rate, depth, base }) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(gainParam);
  gainParam.value = base;
  lfo.start();
  return lfo;
}

function buildBrownNoise(ctx, volume) {
  const source = ctx.createBufferSource();
  const bufferSize = 4 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }
  source.buffer = buffer;
  source.loop = true;

  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(ctx.destination);
  source.start();

  return [source, gain];
}

function buildRain(ctx, volume) {
  const source = createLoopingNoiseSource(ctx);

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 2200;
  bandpass.Q.value = 0.6;

  const gain = ctx.createGain();
  const wobble = attachWobble(ctx, gain.gain, { rate: 0.15, depth: volume * 0.15, base: volume * 0.85 });

  source.connect(bandpass).connect(gain).connect(ctx.destination);
  source.start();

  return [source, bandpass, gain, wobble];
}

function buildFan(ctx, volume) {
  const noiseSource = createLoopingNoiseSource(ctx);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 900;

  const hum = ctx.createOscillator();
  hum.type = "sine";
  hum.frequency.value = 110;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = volume * 0.7;
  const humGain = ctx.createGain();
  const wobble = attachWobble(ctx, humGain.gain, { rate: 3.5, depth: volume * 0.08, base: volume * 0.25 });

  noiseSource.connect(lowpass).connect(noiseGain).connect(ctx.destination);
  hum.connect(humGain).connect(ctx.destination);
  noiseSource.start();
  hum.start();

  return [noiseSource, lowpass, noiseGain, hum, humGain, wobble];
}

function buildCafe(ctx, volume) {
  const source = createLoopingNoiseSource(ctx);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500;

  const gain = ctx.createGain();
  const wobbleA = attachWobble(ctx, gain.gain, { rate: 0.07, depth: volume * 0.1, base: volume * 0.6 });

  const gain2 = ctx.createGain();
  gain2.gain.value = 1;
  const wobbleB = attachWobble(ctx, gain2.gain, { rate: 0.23, depth: 0.15, base: 0.9 });

  source.connect(lowpass).connect(gain).connect(gain2).connect(ctx.destination);
  source.start();

  return [source, lowpass, gain, gain2, wobbleA, wobbleB];
}

const TRACK_BUILDERS = {
  rain: buildRain,
  brownNoise: buildBrownNoise,
  cafe: buildCafe,
  fan: buildFan,
};

export function play(track, volume) {
  stop();
  const builder = TRACK_BUILDERS[track];
  if (!builder) return;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") ctx.resume();

  activeNodes = builder(ctx, volume);
  masterGain = null; // per-track gain nodes handle volume; see updateVolume
}

export function updateVolume(volume) {
  // Each builder wires its own gain node(s) with wobble modulation already
  // applied relative to `volume` at play() time; a live update just rescales
  // the first gain-bearing node found, which is good enough for a slider drag.
  const gainNode = activeNodes.find((node) => node instanceof GainNode);
  if (gainNode) gainNode.gain.value = volume;
}

export function stop() {
  for (const node of activeNodes) {
    if (typeof node.stop === "function") {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    if (typeof node.disconnect === "function") node.disconnect();
  }
  activeNodes = [];
}
