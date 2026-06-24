const { styles, emotions, laneDefs, leadPatterns } = window.darkAlchemyMusicDemoData;

const state = {
  running: false,
  stage: "room",
  boss: "crucible",
  intensity: 2,
  pauseVeil: false,
  step: 0,
  nextTime: 0,
  timer: null,
  barCount: 0,
  phraseBar: 0,
  phraseBars: 4,
  leadPattern: "squelch",
  leadTint: 0,
  flashes: []
};

let ctx, master, comp, filter, delay, feedback, delayWet, reverb, reverbWet, noiseBuffer;
const lanesEl = document.getElementById("lanes");
const canvas = document.getElementById("scope");
laneDefs.forEach(([id, name, group, note, color]) => {
  const el = document.createElement("div");
  el.className = "lane";
  el.dataset.lane = id;
  el.style.setProperty("--lane-color", color);
  el.innerHTML = `<div class="lane-top"><b>${name}</b><i class="dot"></i></div><small>${group} · ${note}</small>`;
  lanesEl.appendChild(el);
});

function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

function modalMidi(style, deg, octave = 0) {
  const wrapped = ((deg % style.scale.length) + style.scale.length) % style.scale.length;
  return style.root + style.scale[wrapped] + (Math.floor(deg / style.scale.length) + octave) * 12;
}

function ensureAudio() {
  if (ctx) return;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0.36;
  comp = ctx.createDynamicsCompressor();
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 6800;
  delay = ctx.createDelay(1.2);
  delay.delayTime.value = 0.24;
  feedback = ctx.createGain();
  feedback.gain.value = 0.25;
  delayWet = ctx.createGain();
  delayWet.gain.value = 0.05;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayWet);
  delayWet.connect(filter);
  reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(1.35, 2.4);
  reverbWet = ctx.createGain();
  reverbWet.gain.value = 0.035;
  reverb.connect(reverbWet);
  reverbWet.connect(filter);
  filter.connect(comp);
  comp.connect(master);
  master.connect(ctx.destination);
  noiseBuffer = makeNoise();
}

function makeNoise() {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeImpulse(seconds, decay) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
  }
  return buffer;
}

function driveCurve(amount) {
  const curve = new Float32Array(256);
  const k = amount * 18;
  for (let i = 0; i < curve.length; i++) {
    const x = i * 2 / curve.length - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function out(node, wet = 0, verb = 0) {
  node.connect(filter);
  if (wet > 0) {
    const send = ctx.createGain();
    send.gain.value = wet;
    node.connect(send);
    send.connect(delay);
  }
  if (verb > 0) {
    const send = ctx.createGain();
    send.gain.value = verb;
    node.connect(send);
    send.connect(reverb);
  }
}

function envGain(time, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return g;
}

function padGain(time, peak, attack, hold, release) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), time + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
  return g;
}

function kick(time, accent = 1) {
  const o = ctx.createOscillator();
  const g = envGain(time, 0.75 * accent, 0.006, 0.18);
  o.type = "sine";
  o.frequency.setValueAtTime(120, time);
  o.frequency.exponentialRampToValueAtTime(42, time + 0.16);
  o.connect(g);
  out(g, 0.02);
  o.start(time);
  o.stop(time + 0.22);
  flash("fixedPulse");
}

function selectEmotion() {
  if (state.pauseVeil || state.intensity <= 1) return emotions.suspended;
  if (state.stage === "boss" && state.intensity >= 4) return emotions.frenzy;
  if (state.stage === "boss") return emotions.bossRitual;
  if (state.stage === "surge" || state.intensity >= 3) return emotions.pressure;
  return emotions.darkStable;
}

function chordSlot(step = state.step) { return Math.floor(step / 16) % 4; }

function currentChord(step = state.step) {
  const emotion = selectEmotion();
  const slot = chordSlot(step);
  return {
    emotion,
    rootDegree: emotion.roots[slot % emotion.roots.length],
    quality: emotion.qualities[slot % emotion.qualities.length]
  };
}

function chordOffsets(quality) {
  if (quality === "power") return [0, 7, 12];
  if (quality === "sus") return [0, 5, 7, 10];
  if (quality === "major") return [0, 4, 7, 11];
  if (quality === "dominant") return [0, 4, 7, 10];
  if (quality === "dim") return [0, 3, 6, 9];
  return [0, 3, 7, 10];
}

function padChord(time, rootDegree, quality) {
  const style = styles[state.boss];
  const rootOffset = style.scale[((rootDegree % 7) + 7) % 7] - 12;
  const hold = secondsPerStep() * 13.5;
  const release = secondsPerStep() * 2;
  const chord = chordOffsets(quality);
  const ph = ctx.createBiquadFilter();
  const lp = ctx.createBiquadFilter();
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  const g = padGain(time, style.padGain * (0.75 + state.intensity * 0.09), 0.28, hold, release);
  ph.type = "allpass";
  ph.frequency.value = 520 + state.intensity * 45;
  lfo.frequency.value = 0.045 + state.intensity * 0.015;
  lfoDepth.gain.value = state.boss === "darkpsy" ? 520 : 260;
  lfo.connect(lfoDepth);
  lfoDepth.connect(ph.frequency);
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(style.padFilter + state.intensity * 180, time);
  lp.Q.value = state.boss === "venom" ? 3.2 : 1.1;
  chord.forEach((offset, i) => {
    const o = ctx.createOscillator();
    o.type = style.padWave;
    o.frequency.setValueAtTime(midi(style.root + rootOffset + offset + (i > 2 ? 12 : 0)), time);
    o.detune.setValueAtTime((i - 1.5) * (state.boss === "crucible" ? 7 : 4), time);
    o.connect(ph);
    o.start(time);
    o.stop(time + hold + release + 0.35);
  });
  ph.connect(lp);
  lp.connect(g);
  out(g, style.padWet * 0.55, style.padWet);
  lfo.start(time);
  lfo.stop(time + hold + release + 0.35);
  flash("emotionPad");
}

function hat(time, open = false) {
  const src = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = envGain(time, open ? 0.14 : 0.09, 0.003, open ? 0.22 : 0.055);
  src.buffer = noiseBuffer;
  hp.type = "highpass";
  hp.frequency.value = open ? 6500 : 8200;
  src.connect(hp);
  hp.connect(g);
  out(g, 0.015);
  src.start(time);
  src.stop(time + (open ? 0.28 : 0.08));
  flash("hat");
}

function note(time, deg, octave = 0, type = "sawtooth", dur = 0.18, gain = 0.12, wet = 0.08) {
  const style = styles[state.boss];
  const o = ctx.createOscillator();
  const g = envGain(time, gain, 0.012, dur);
  o.type = type;
  o.frequency.setValueAtTime(midi(modalMidi(style, deg, octave)), time);
  o.connect(g);
  out(g, wet);
  o.start(time);
  o.stop(time + dur + 0.05);
}

function stab(time, color = 0) {
  const chord = currentChord();
  const root = chord.rootDegree + color;
  [root, root + 2, root + 4].forEach((d, i) => note(time + i * 0.002, d, i === 2 ? 1 : 0, "sawtooth", 0.32, 0.07, 0.11));
  flash("stab");
}

function acid(time, step) {
  const style = styles[state.boss];
  const o = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = envGain(time, 0.1, 0.006, 0.2);
  const f = midi(style.root + style.scale[(step / 2) % style.scale.length | 0] + 12);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(f, time);
  lp.type = "lowpass";
  lp.Q.value = 10;
  lp.frequency.setValueAtTime(420, time);
  lp.frequency.exponentialRampToValueAtTime(2400 + state.intensity * 400, time + 0.08);
  o.connect(lp);
  lp.connect(g);
  out(g, 0.08);
  o.start(time);
  o.stop(time + 0.24);
  flash("acid");
}

function rollVariation() {
  const keys = Object.keys(leadPatterns);
  const pool = state.intensity >= 4 ? keys : ["squelch", "throat"];
  state.leadPattern = pool[(Math.random() * pool.length) | 0];
  state.leadTint = Math.random() < 0.5 ? 0 : 1;
  state.phraseBars = Math.random() < 0.42 ? 8 : 4;
}

function transitionFill(time) {
  if (state.stage === "room" && state.intensity < 3) return;
  const stepDur = secondsPerStep();
  riser(time + stepDur * 10);
  psyLead(time + stepDur * 15, state.step + 15, true);
  flash("riser");
}

function psyLead(time, step, pickup = false) {
  const chord = currentChord();
  const pat = leadPatterns[state.leadPattern];
  const idx = Math.floor(step / Math.max(1, pat.every)) % pat.semis.length;
  const base = midi(modalMidi(styles[state.boss], chord.rootDegree, 2));
  const freq = base * Math.pow(2, pat.semis[idx] / 12);
  const drive = ctx.createWaveShaper();
  const bp = ctx.createBiquadFilter();
  const dur = pickup ? pat.dur * 0.62 : pat.dur;
  const g = envGain(time, (pat.gain + state.intensity * 0.004) * (pickup ? 0.75 : 1), 0.004, dur);
  drive.curve = driveCurve(state.boss === "darkpsy" ? 2.2 : 1.25);
  drive.oversample = "2x";
  bp.type = "bandpass";
  const startHz = (state.boss === "darkpsy" ? 1250 : 1750) + state.leadTint * 320;
  bp.frequency.setValueAtTime(startHz, time);
  bp.frequency.exponentialRampToValueAtTime(startHz + 1900 * pat.sweep, time + dur * 0.75);
  bp.Q.value = state.boss === "darkpsy" ? 8 : 5;
  ["sawtooth", "square"].forEach((type, i) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq * (i ? 1.005 : 1), time);
    o.frequency.exponentialRampToValueAtTime(freq * pat.bend * (i ? 1.005 : 1), time + dur * 0.55);
    o.detune.setValueAtTime(i ? 9 : -5, time);
    o.connect(bp);
    o.start(time);
    o.stop(time + dur + 0.05);
  });
  bp.connect(drive);
  drive.connect(g);
  out(g, 0.07, state.boss === "darkpsy" ? 0.18 : 0.1);
  flash("roll");
}

function riser(time) {
  const src = ctx.createBufferSource();
  const bp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noiseBuffer;
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(600, time);
  bp.frequency.exponentialRampToValueAtTime(5800, time + 0.65);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(0.16, time + 0.58);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.72);
  src.connect(bp);
  bp.connect(g);
  out(g, 0.2);
  src.start(time);
  src.stop(time + 0.75);
  flash("riser");
}

function impact(time) {
  kick(time, 1.25);
  note(time, 0, -1, "triangle", 0.45, 0.16, 0.18);
  flash("riser");
}

function scheduleStep(time) {
  const s = state.step;
  const intensity = state.intensity;
  const stage = state.stage;
  const isAether = state.boss === "aether";

  if (s % 4 === 0) kick(time, s % 16 === 0 ? 1.1 : 0.86);
  if (s % 16 === 0) {
    if (state.barCount > 0 && state.phraseBar === 0) rollVariation();
    if (state.phraseBar === state.phraseBars - 1) transitionFill(time);
    state.phraseBar = (state.phraseBar + 1) % state.phraseBars;
    state.barCount++;
    note(time, 0, -2, "sine", 1.2, 0.06, 0.14);
    const chord = currentChord(s);
    padChord(time, chord.rootDegree, chord.quality);
    flash("fixedDrone");
  }

  if (state.pauseVeil) {
    if (s % 8 === 4) note(time, 0, -1, "triangle", 0.4, 0.05, 0.3);
    flash("pause");
    return;
  }

  if (intensity >= 1 && s % (isAether ? 1 : 2) === 0) hat(time, intensity >= 3 && s % 4 === 2);
  if (intensity >= 2 && (s % 8 === 4 || (stage === "boss" && s % 16 === 12))) stab(time, stage === "boss" ? 1 : 0);
  if (intensity >= 3 && (stage !== "room" || s % 16 === 10) && s % 4 === 2) acid(time, s);
  const pat = leadPatterns[state.leadPattern];
  const leadEvery = intensity >= 4 ? 2 : pat.every;
  if (intensity >= 3 && (stage === "surge" || stage === "boss") && s % leadEvery === 1) {
    psyLead(time, s + intensity);
  }
  if (intensity >= 4 && stage !== "room" && s % 32 === 28) riser(time);
  if (stage === "boss" && s % 32 === 0) impact(time);
}

function secondsPerStep() { return 60 / styles[state.boss].bpm / 4; }

function scheduler() {
  while (state.nextTime < ctx.currentTime + 0.12) {
    scheduleStep(state.nextTime);
    state.nextTime += secondsPerStep();
    state.step = (state.step + 1) % 64;
  }
}

function flash(id) {
  state.flashes.push({ id, t: performance.now() });
}

function triggerPhrase(kind) {
  ensureAudio();
  const t = ctx.currentTime + 0.04;
  if (kind === "paddle") kick(t, 1.35);
  if (kind === "brick") stab(t, 2);
  if (kind === "combo") [0, 2, 4, 6].forEach((d, i) => note(t + i * 0.07, d, 2, "square", 0.12, 0.08, 0.1));
  if (kind === "warning") {
    riser(t);
    impact(t + 0.62);
  }
}

function startStop() {
  ensureAudio();
  if (!state.running) {
        ctx.resume();
        state.running = true;
        state.nextTime = ctx.currentTime + 0.06;
        state.step = 0;
        state.barCount = 0;
        state.phraseBar = 0;
        rollVariation();
        state.timer = setInterval(scheduler, 25);
  } else {
    state.running = false;
    clearInterval(state.timer);
  }
  updateUi();
}

function updateFx() {
  if (!ctx) return;
  if (state.pauseVeil) {
    filter.frequency.setTargetAtTime(760, ctx.currentTime, 0.08);
    delayWet.gain.setTargetAtTime(0.24, ctx.currentTime, 0.08);
    reverbWet.gain.setTargetAtTime(0.18, ctx.currentTime, 0.08);
    feedback.gain.setTargetAtTime(0.42, ctx.currentTime, 0.08);
    return;
  }
  const boss = styles[state.boss];
  filter.frequency.setTargetAtTime(boss.name === "Gothic" ? 4200 : 6400 + state.intensity * 750, ctx.currentTime, 0.08);
  delayWet.gain.setTargetAtTime(state.intensity >= 4 ? 0.11 : 0.055, ctx.currentTime, 0.08);
  reverbWet.gain.setTargetAtTime(state.boss === "darkpsy" ? 0.16 : state.intensity >= 4 ? 0.09 : 0.04, ctx.currentTime, 0.08);
  feedback.gain.setTargetAtTime(state.boss === "venom" ? 0.36 : 0.22, ctx.currentTime, 0.08);
}

function laneActive(id) {
  if (id === "fixedPulse" || id === "fixedDrone") return true;
  if (id === "emotionPad") return true;
  if (id === "pause") return state.pauseVeil;
  if (state.pauseVeil) return false;
  if (id === "hat") return state.intensity >= 1;
  if (id === "stab") return state.intensity >= 2;
  if (id === "acid") return state.intensity >= 3 && state.stage !== "room";
  if (id === "roll") return state.intensity >= 4 && state.stage !== "room";
  if (id === "riser") return state.intensity >= 4 && state.stage !== "room";
  return false;
}

function updateUi() {
  const boss = styles[state.boss];
  document.getElementById("startBtn").textContent = state.running ? "Stop Audio" : "Start Audio";
  document.getElementById("stageText").textContent = state.stage[0].toUpperCase() + state.stage.slice(1);
  document.getElementById("intensityText").textContent = state.intensity;
  document.getElementById("intensityBar").style.width = `${(state.intensity / 5) * 100}%`;
  document.getElementById("bossText").textContent = boss.name;
  document.getElementById("pauseText").textContent = state.pauseVeil ? "On" : "Off";
  document.getElementById("pauseBtn").classList.toggle("active", state.pauseVeil);
  document.getElementById("bpmReadout").textContent = `${boss.bpm} BPM`;
  document.getElementById("modeReadout").textContent = boss.mode;
  document.getElementById("chordReadout").textContent = selectEmotion().text;
  document.getElementById("fxReadout").textContent = state.pauseVeil ? "Pause Veil" : `${boss.fx} · ${leadPatterns[state.leadPattern].name}`;
  document.querySelectorAll("[data-stage]").forEach(b => b.classList.toggle("active", b.dataset.stage === state.stage));
  document.querySelectorAll("[data-boss]").forEach(b => b.classList.toggle("active", b.dataset.boss === state.boss));
  document.querySelectorAll(".lane").forEach(el => el.classList.toggle("on", laneActive(el.dataset.lane)));
  updateFx();
}

document.getElementById("startBtn").addEventListener("click", startStop);
document.getElementById("intensity").addEventListener("input", e => {
  state.intensity = Number(e.target.value);
  updateUi();
});
document.getElementById("stageButtons").addEventListener("click", e => {
  const btn = e.target.closest("button[data-stage]");
  if (!btn) return;
  state.stage = btn.dataset.stage;
  updateUi();
});
document.getElementById("bossButtons").addEventListener("click", e => {
  const btn = e.target.closest("button[data-boss]");
  if (!btn) return;
  state.boss = btn.dataset.boss;
  updateUi();
});
document.getElementById("pauseBtn").addEventListener("click", () => {
  state.pauseVeil = !state.pauseVeil;
  updateUi();
});
document.querySelector(".phrases").addEventListener("click", e => {
  const btn = e.target.closest("button[data-phrase]");
  if (btn) triggerPhrase(btn.dataset.phrase);
});

updateUi();
window.startDarkAlchemyVisualizer({ canvas, state, laneDefs, laneActive });
