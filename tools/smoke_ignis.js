// Smoke test for dark_psy_engine_demo.html hybrid-ignis rework.
// Mocks Web Audio, forces pure-synth path, instruments voices, drives the
// scheduler across calm+rage for ignis (and a regression pass on other bosses).
const fs = require('fs');
const HTML = process.argv[2] ||
  'docs/architecture/music_processing/dark_psy_engine_demo.html';
const src = fs.readFileSync(HTML, 'utf8');
const a = src.indexOf('class SoundManagerStub');
const b = src.indexOf('const $=id=>document.getElementById(id);');
if (a < 0 || b < 0) { console.error('FAIL: class boundaries not found', a, b); process.exit(1); }
const code = src.slice(a, b);

// ---- integrity: the new symbols must be present in the bash-read slice ----
const need = ['furnaceKick', 'furnaceRoll', 'furnaceRollDrive', 'playVibraslap', "sig.vibraslap"];
const missing = need.filter(s => !code.includes(s));
if (missing.length) { console.error('FAIL: missing new symbols (truncated read?):', missing); process.exit(1); }

// ---- Web Audio mock ----
function audioParam() {
  const p = { value: 0 };
  for (const m of ['setValueAtTime','setTargetAtTime','exponentialRampToValueAtTime',
    'linearRampToValueAtTime','cancelScheduledValues','cancelAndHoldAtTime','setValueCurveAtTime'])
    p[m] = () => p;
  return p;
}
function makeNode() {
  const o = { connect() { return o; }, disconnect() {}, start() {}, stop() {},
    getChannelData() { return new Float32Array(16); } };
  return new Proxy(o, {
    get(t, k) { if (k in t) return t[k]; const s = '$' + String(k);
      if (!t[s]) t[s] = audioParam(); return t[s]; },
    set(t, k, v) { t[k] = v; return true; }
  });
}
const ctx = { currentTime: 0, sampleRate: 44100, destination: makeNode(), state: 'running',
  createGain: makeNode, createOscillator: makeNode, createBiquadFilter: makeNode,
  createWaveShaper: makeNode, createDelay: makeNode, createStereoPanner: makeNode,
  createConvolver: makeNode, createDynamicsCompressor: makeNode, createBufferSource: makeNode,
  createBuffer: () => makeNode(), resume() { return Promise.resolve(); } };
global.window = { AudioContext: function () { return ctx; }, webkitAudioContext: function () { return ctx; } };

let MusicEngine, SoundManagerStub;
eval(code + '\n;globalThis.__MusicEngine=MusicEngine;globalThis.__SoundManagerStub=SoundManagerStub;');
MusicEngine = globalThis.__MusicEngine;
SoundManagerStub = globalThis.__SoundManagerStub;

const VOICES = ['playKick','playFurnaceKick','playFurnaceTom','playVibraslap','playTom','playModal','playHeat',
  'playBass','playShaker','playHat','duck','playWood','riser','impact'];

const sm = new SoundManagerStub();
const music = new MusicEngine(sm);
music._coreSamples = false; music.fxSamples = false; music._bassSrc = 'synth'; music._kit = { ready: false };

function instrument() {
  const c = {}; VOICES.forEach(m => {
    c[m] = 0; const orig = MusicEngine.prototype[m];
    music[m] = function (...args) { c[m]++; return orig.apply(this, args); };
  });
  return c;
}
function drive(boss, section, bars) {
  music.applyBossProfile(boss, { snap: true, section });
  const c = instrument(); let t = 1, err = null; const pm = [], pb = [];
  try {
    for (let bar = 0; bar < bars; bar++) {
      const m0 = c.playModal, b0 = c.playBass;
      music._bar = bar; music._onBarStart(t);
      for (let s = 0; s < 16; s++) { music._scheduleStep(s, t); t += 0.05; }
      pm.push(c.playModal - m0); pb.push(c.playBass - b0);
    }
  } catch (e) { err = (e && e.stack) || String(e); }
  const avg = arr => arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0;
  return { c, err, modalAvg: avg(pm), bassAvg: avg(pb) };
}

let failed = false;
const ok = (cond, msg) => { console.log((cond ? '  PASS ' : '  FAIL ') + msg); if (!cond) failed = true; };

console.log('== ignis CALM (32 bars) ==');
const calm = drive('ignis', 'calm', 32);
ok(!calm.err, 'no exception' + (calm.err ? ('\n' + calm.err) : ''));
ok(calm.c.playFurnaceKick > 0, 'four-on-floor furnace KICK fires (' + calm.c.playFurnaceKick + ')');
ok(calm.c.playTom > 0, 'mid tom layer fires (' + calm.c.playTom + ')');
ok(calm.c.playVibraslap > 0, 'vibraslap buzz fires (' + calm.c.playVibraslap + ')');
ok(calm.c.playBass > 0, 'rolling bass fires (' + calm.c.playBass + ')');
ok(calm.c.playModal > 0, 'modal call-response fires (' + calm.c.playModal + ')');
ok(calm.c.playHeat > 0, 'heat pulse (furnace sig) fires (' + calm.c.playHeat + ')');

console.log('== ignis RAGE (16 bars) ==');
const rage = drive('ignis', 'rage', 16);
ok(!rage.err, 'no exception' + (rage.err ? ('\n' + rage.err) : ''));
ok(rage.c.playFurnaceKick > 0, 'furnace kick still drives in rage (' + rage.c.playFurnaceKick + ')');
ok(rage.c.playVibraslap > 0, 'vibraslap denser in rage (' + rage.c.playVibraslap + ')');
ok(rage.c.playTom > 0, 'tom pickup/climax rolls fire (' + rage.c.playTom + ')');
ok(rage.c.playModal > 0, 'melody PERSISTS in rage (not silent) (' + rage.c.playModal + ')');

console.log('== BUILD (not collapse) check ==');
ok(rage.modalAvg >= calm.modalAvg, 'rage modal/bar >= calm (' + rage.modalAvg.toFixed(2) + ' vs ' + calm.modalAvg.toFixed(2) + ')');
ok(rage.bassAvg >= calm.bassAvg, 'rage bass/bar >= calm (build) (' + rage.bassAvg.toFixed(2) + ' vs ' + calm.bassAvg.toFixed(2) + ')');
ok(rage.c.playVibraslap / 16 >= calm.c.playVibraslap / 32, 'rage vibraslap/bar >= calm/bar');

console.log('== regression: other bosses (8 bars each, calm+rage) ==');
for (const boss of ['glacies', 'mikro', 'devourer', 'viridis', 'tesla', 'chimera', 'ouroboros']) {
  const r1 = drive(boss, 'calm', 8), r2 = drive(boss, 'rage', 8);
  ok(!r1.err && !r2.err, boss + ' schedules clean' + (r1.err || r2.err ? ('\n' + (r1.err || r2.err)) : ''));
}

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: ALL PASS');
process.exit(failed ? 1 : 0);
