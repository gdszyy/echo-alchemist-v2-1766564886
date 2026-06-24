window.darkAlchemyMusicDemoData = {
  styles: {
    crucible: {
      name: "Crucible", bpm: 128, mode: "Phrygian", root: 45,
      scale: [0, 1, 3, 5, 7, 8, 10], color: "#cda15a", fx: "Filter + Duck",
      padWave: "sawtooth", padFilter: 1450, padWet: 0.12, padGain: 0.062
    },
    venom: {
      name: "Venom", bpm: 140, mode: "Aeolian Trap", root: 43,
      scale: [0, 2, 3, 5, 7, 8, 10], color: "#7bd889", fx: "Bandpass + Slime Delay",
      padWave: "triangle", padFilter: 980, padWet: 0.2, padGain: 0.07
    },
    aether: {
      name: "Aether", bpm: 172, mode: "Fast DnB", root: 50,
      scale: [0, 2, 3, 5, 7, 9, 10], color: "#78d9ff", fx: "Sparkle + Fast Hats",
      padWave: "sine", padFilter: 2400, padWet: 0.09, padGain: 0.052
    },
    gothic: {
      name: "Gothic", bpm: 140, mode: "Harmonic Minor", root: 44,
      scale: [0, 2, 3, 5, 7, 8, 11], color: "#ba8cff", fx: "Half-time Verb",
      padWave: "triangle", padFilter: 1180, padWet: 0.26, padGain: 0.082
    },
    darkpsy: {
      name: "Dark Psy", bpm: 150, mode: "Occult Phrygian", root: 42,
      scale: [0, 1, 3, 5, 7, 8, 10], color: "#ff6b5f", fx: "Drive + Reverb",
      padWave: "sawtooth", padFilter: 900, padWet: 0.32, padGain: 0.058
    }
  },
  emotions: {
    suspended: { name: "Suspended Matter", text: "i5 drone", roots: [0, 0, 0, 0], qualities: ["power", "sus", "power", "sus"] },
    darkStable: { name: "Dark Stability", text: "i - bII - i - VII", roots: [0, 1, 0, 6], qualities: ["minor", "major", "minor", "major"] },
    pressure: { name: "Pressure Coil", text: "i - bII - i - V7", roots: [0, 1, 0, 4], qualities: ["minor", "major", "minor", "dominant"] },
    bossRitual: { name: "Boss Ritual", text: "i - bII - V7 - i", roots: [0, 1, 4, 0], qualities: ["minor", "major", "dominant", "minor"] },
    frenzy: { name: "Frenzy Drop", text: "i - bII - dim - V7", roots: [0, 1, 3, 4], qualities: ["minor", "major", "dim", "dominant"] }
  },
  laneDefs: [
    ["fixedPulse", "Fixed Pulse", "low", "always-on kick / sub", "#cda15a"],
    ["fixedDrone", "Root Drone", "mid", "ritual root bed", "#85705a"],
    ["emotionPad", "Emotion Pad", "mid", "chord progression engine", "#d0a8ff"],
    ["hat", "Metal Hat", "high", "intensity >= 1", "#bfc7c1"],
    ["stab", "Alchemy Stab", "mid", "intensity >= 2", "#ba8cff"],
    ["acid", "Acid Thread", "mid", "surge / boss at intensity >= 3", "#7bd889"],
    ["roll", "Psy Lead", "high", "tense drive + reverb", "#78d9ff"],
    ["riser", "Riser FX", "fx", "surge / boss pressure", "#ff6b5f"],
    ["pause", "Pause Veil", "fx", "filtered echo state", "#8fa39b"]
  ],
  leadPatterns: {
    squelch: { name: "Squelch", semis: [0, 1, 0, -1], every: 4, dur: 0.07, gain: 0.052, bend: 1.035, sweep: 0.82 },
    laser: { name: "Laser", semis: [0, 0, 1, 0], every: 3, dur: 0.052, gain: 0.045, bend: 1.075, sweep: 1.08 },
    throat: { name: "Throat", semis: [0, -1, 0, 1], every: 4, dur: 0.09, gain: 0.05, bend: 0.975, sweep: 0.68 },
    scrape: { name: "Scrape", semis: [0, 0, -1, 0], every: 5, dur: 0.11, gain: 0.046, bend: 1.015, sweep: 0.55 }
  }
};
