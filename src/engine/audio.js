/**
 * Generative music and sound effects with the Web Audio API. No audio files are used.
 *
 * The score never loops: a slow harmony walk chooses chords, and short "sections" of different
 * instruments (piano, guitar, alphorn, music box) come and go with silences in between.
 * Wind, birds and distant cowbells play underneath.
 */
import { pickRandom, rand } from "../core/random.js";

const PENTATONIC = [0, 2, 4, 7, 9, 12];
/** Seven-note scale for each season, as semitones from the root. */
const SEASON_MODES = {
  spring: [0, 2, 4, 5, 7, 9, 11],
  summer: [0, 2, 4, 6, 7, 9, 11],
  autumn: [0, 2, 3, 5, 7, 9, 10],
  winter: [0, 2, 3, 5, 7, 8, 10],
};
/** Which scale degree may follow which: a gentle, non-repeating chord walk. */
const CHORD_WALK = {
  0: [3, 5, 1, 4],
  1: [4, 6, 3],
  2: [5, 3],
  3: [0, 1, 5, 4],
  4: [0, 5, 3],
  5: [3, 1, 2, 0],
  6: [0, 5],
};
/** Instruments that suit each time of day. */
const SECTIONS_BY_PHASE = {
  dawn: ["piano", "rest", "melody", "guitar"],
  day: ["guitar", "melody", "piano", "alphorn", "rest"],
  evening: ["piano", "alphorn", "rest", "pad"],
  night: ["musicbox", "pad", "rest", "piano"],
};

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

/** Public audio settings. */
export const audioSettings = { music: true, effects: true };

/** @type {() => { phase: string, season: string }} */
let musicContext = () => ({ phase: "night", season: "summer" });

/** Tells the composer what time of day and season it is. */
export function setMusicContext(provider) {
  musicContext = provider;
}

/** All Web Audio nodes and composer state; created on the first user gesture. */
const engine = {
  /** @type {AudioContext | null} */ ctx: null,
  /** @type {any} */ nodes: {},
  /** @type {AudioBuffer | null} */ noise: null,
  nextBarTime: 0,
  nextAmbientTime: 0,
  bar: 0,
  key: 0,
  degree: 0,
  /** @type {{ kind: string, barsLeft: number, barLength: number, motif: number[], brushes: boolean } | null} */
  section: null,
  /** @type {{ stop: () => void } | null} */ purr: null,
};

/** Pauses or resumes all sound, e.g. while the tab is hidden. */
export function setAudioPaused(paused) {
  if (!engine.ctx) return;
  if (paused) engine.ctx.suspend();
  else engine.ctx.resume();
}

/** Starts audio. Browsers only allow this after a user gesture, so call it from input events. */
export function initAudio() {
  if (engine.ctx) {
    engine.ctx.resume();
    return;
  }
  try {
    const Ctor =
      window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    const ctx = new Ctor();
    engine.ctx = ctx;
    const n = engine.nodes;

    n.master = ctx.createGain();
    n.master.gain.value = 0.85;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 3;
    n.master.connect(compressor).connect(ctx.destination);

    n.music = ctx.createGain();
    n.music.gain.value = audioSettings.music ? 0.55 : 0;
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 2600;
    n.music.connect(soften).connect(n.master);

    n.ambience = ctx.createGain();
    n.ambience.gain.value = audioSettings.music ? 0.5 : 0;
    n.ambience.connect(n.master);

    n.effects = ctx.createGain();
    n.effects.gain.value = 0.55;
    n.effects.connect(n.master);

    // A large, soft reverb: the mountain valley.
    n.reverb = ctx.createConvolver();
    n.reverb.buffer = makeReverbImpulse(ctx, 4.5);
    n.reverbLevel = ctx.createGain();
    n.reverbLevel.gain.value = 2.2;
    n.reverb.connect(n.reverbLevel).connect(n.master);
    n.musicSend = ctx.createGain();
    n.musicSend.gain.value = 0.65;
    n.musicSend.connect(n.reverb);
    n.music.connect(n.musicSend);
    n.ambienceSend = ctx.createGain();
    n.ambienceSend.gain.value = 0.8;
    n.ambienceSend.connect(n.reverb);

    engine.noise = makeNoise(ctx, 6);
    startWind(ctx);

    engine.key = pickRandom([0, 2, 5, 7, -3]);
    engine.nextBarTime = ctx.currentTime + 0.3;
    engine.nextAmbientTime = ctx.currentTime + 6;
    setInterval(schedule, 300);
  } catch {
    engine.ctx = null; // Audio is optional: the game plays fine without it.
  }
}

function makeReverbImpulse(ctx, seconds) {
  const length = ctx.sampleRate * seconds;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let smoothed = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const sample = (Math.random() - 0.5) * Math.pow(1 - t, 2.6);
      smoothed += (sample - smoothed) * (0.5 - 0.42 * t);
      data[i] = smoothed;
    }
  }
  return impulse;
}

function makeNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startWind(ctx) {
  const source = ctx.createBufferSource();
  source.buffer = engine.noise;
  source.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.6;
  const level = ctx.createGain();
  level.gain.value = 0.02;
  const gust = ctx.createOscillator();
  gust.frequency.value = 0.06;
  const gustDepth = ctx.createGain();
  gustDepth.gain.value = 220;
  gust.connect(gustDepth).connect(band.frequency);
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.041;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 0.012;
  swell.connect(swellDepth).connect(level.gain);
  source.connect(band).connect(level).connect(engine.nodes.ambience);
  source.start();
  gust.start();
  swell.start();
}

/**
 * One enveloped oscillator note.
 * @param {number} frequency
 * @param {number} time
 * @param {{ duration: number, volume: number, type?: OscillatorType, attack?: number,
 *   hold?: number, detune?: number, lowpass?: number, lowpassEnd?: number, destination?: AudioNode }} o
 */
function tone(frequency, time, o) {
  const ctx = /** @type {AudioContext} */ (engine.ctx);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.value = frequency;
  if (o.detune) osc.detune.value = o.detune;
  /** @type {AudioNode} */
  let last = osc;
  if (o.lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(o.lowpass, time);
    if (o.lowpassEnd) {
      filter.frequency.exponentialRampToValueAtTime(
        o.lowpassEnd,
        time + o.duration,
      );
    }
    osc.connect(filter);
    last = filter;
  }
  const attack = o.attack ?? 0.01;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(o.volume, time + attack);
  if (o.hold) gain.gain.setValueAtTime(o.volume, time + attack + o.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + o.duration);
  last.connect(gain).connect(o.destination ?? engine.nodes.music);
  osc.start(time);
  osc.stop(time + o.duration + 0.1);
}

const INSTRUMENTS = {
  piano(note, time, volume) {
    const f = midiToHz(note);
    tone(f, time, { duration: 3.4, volume });
    tone(f * 2, time, { duration: 1.6, volume: volume * 0.22 });
    tone(f * 3, time, { duration: 0.6, volume: volume * 0.07 });
  },
  guitar(note, time, volume) {
    tone(midiToHz(note), time, {
      duration: 1.3,
      volume,
      type: "triangle",
      lowpass: 1800,
      lowpassEnd: 400,
    });
  },
  musicbox(note, time, volume) {
    const f = midiToHz(note);
    tone(f, time, { duration: 2.2, volume });
    tone(f * 4.02, time, { duration: 0.5, volume: volume * 0.14 });
  },
  pad(notes, time, duration, volume) {
    for (const note of notes) {
      for (const detune of [-5, 5]) {
        tone(midiToHz(note), time, {
          duration: duration + 2.5,
          attack: 2.4,
          hold: Math.max(0.1, duration - 2.4),
          volume,
          type: "triangle",
          detune,
          lowpass: 800,
        });
      }
    }
  },
  alphorn(note, time, duration, volume) {
    const send = engine.nodes.ambienceSend;
    tone(midiToHz(note), time, {
      duration,
      attack: 0.5,
      hold: duration * 0.4,
      volume,
      type: "sawtooth",
      lowpass: 520,
      destination: send,
    });
    tone(midiToHz(note - 12), time, {
      duration,
      attack: 0.6,
      hold: duration * 0.4,
      volume: volume * 0.6,
      type: "sawtooth",
      lowpass: 360,
      destination: send,
    });
  },
};

/** The current chord: a root for the bass and five chord tones to choose melody notes from. */
function currentChord() {
  const mode = SEASON_MODES[musicContext().season] ?? SEASON_MODES.summer;
  const degree = (i) => {
    const step = engine.degree + i;
    return mode[step % 7] + 12 * Math.floor(step / 7);
  };
  return {
    bass: 48 + engine.key + mode[engine.degree],
    tones: [0, 2, 4, 6, 8].map((i) => 60 + engine.key + degree(i)),
    scale: mode,
  };
}

function startSection() {
  const pool =
    SECTIONS_BY_PHASE[musicContext().phase] ?? SECTIONS_BY_PHASE.night;
  let kind = pickRandom(pool);
  if (engine.section && kind === engine.section.kind) kind = "rest";
  engine.section = {
    kind,
    barsLeft:
      kind === "rest" ? 2 + Math.floor(rand(2)) : 3 + Math.floor(rand(4)),
    barLength: (60 / rand(50, 58)) * 4,
    motif: [
      pickRandom([0, 1, 2]),
      pickRandom([1, 2, 3]),
      pickRandom([2, 3, 4]),
      pickRandom([1, 2]),
    ],
    brushes: Math.random() < 0.22 && kind !== "rest" && kind !== "musicbox",
  };
  // Now and then drift to a related key so the music never settles into a loop.
  if (Math.random() < 0.3) {
    engine.key =
      ((engine.key + pickRandom([5, -5, 2, -2, 7, -7]) + 18) % 12) - 6;
  }
}

/** Schedules the next bars of music slightly ahead of time. */
function schedule() {
  const ctx = engine.ctx;
  if (!ctx || ctx.state !== "running") return;
  while (engine.nextBarTime < ctx.currentTime + 1.2) {
    if (!engine.section || engine.section.barsLeft <= 0) startSection();
    playBar(
      /** @type {NonNullable<typeof engine.section>} */ (engine.section),
      engine.nextBarTime,
    );
    engine.nextBarTime += engine.section?.barLength ?? 4;
  }
  if (ctx.currentTime > engine.nextAmbientTime) {
    playAmbience(ctx.currentTime + 0.1);
    engine.nextAmbientTime = ctx.currentTime + rand(9, 26);
  }
}

function playBar(section, time) {
  const chord = currentChord();
  const beat = section.barLength / 4;
  const humanise = () => rand(-0.025, 0.025);
  section.barsLeft -= 1;

  if (section.kind !== "rest" || Math.random() < 0.5) {
    INSTRUMENTS.pad(
      [chord.tones[0] - 12, chord.tones[1] - 12, chord.tones[3] - 12],
      time,
      section.barLength * 0.95,
      0.018,
    );
  }
  if (section.kind !== "rest" && Math.random() < 0.75) {
    tone(midiToHz(chord.bass - 12), time, {
      duration: section.barLength * 0.9,
      attack: 0.6,
      hold: section.barLength * 0.3,
      volume: 0.07,
    });
  }

  switch (section.kind) {
    case "piano":
      pickRandom([
        [0, 2, 3],
        [0, 1.5, 3],
        [0.5, 2.5],
        [0, 3],
      ]).forEach((b, i) =>
        INSTRUMENTS.piano(
          chord.tones[(section.motif[i % 4] + engine.bar) % 5],
          time + b * beat + humanise(),
          0.055 + rand(0.02),
        ),
      );
      break;
    case "guitar":
      pickRandom([
        [0, 1, 1.5, 2, 3],
        [0, 0.5, 1, 2.5],
        [0, 1.5, 2, 3.5],
      ]).forEach((b, i) =>
        INSTRUMENTS.guitar(
          chord.tones[[0, 2, 1, 3, 2][i % 5]] - 12,
          time + b * beat + humanise(),
          0.05 + rand(0.02),
        ),
      );
      break;
    case "melody":
      if (Math.random() < 0.8)
        playMelodyPhrase(section, chord, time, beat, humanise);
      break;
    case "musicbox":
      if (Math.random() < 0.75) {
        pickRandom([
          [0, 1, 2],
          [0, 2],
          [1, 2.5],
        ]).forEach((b, i) =>
          INSTRUMENTS.musicbox(
            chord.tones[(section.motif[i % 4] + 2) % 5] + 12,
            time + b * beat + humanise(),
            0.028,
          ),
        );
      }
      break;
    case "alphorn":
      if (engine.bar % 2 === 0) {
        const root = chord.tones[0] - 12;
        INSTRUMENTS.alphorn(root, time, 3.2, 0.012);
        INSTRUMENTS.alphorn(root + 7, time + 2.6, 3.6, 0.012);
      }
      break;
    default:
      break;
  }
  if (section.brushes) playBrushes(time, beat);
  engine.degree = pickRandom(CHORD_WALK[engine.degree]);
  engine.bar += 1;
}

function playMelodyPhrase(section, chord, time, beat, humanise) {
  const octave = 72 + engine.key;
  let index = section.motif[engine.bar % 4] + Math.floor(Math.random() * 2);
  let at = pickRandom([0, 0.5, 1]);
  const notes = pickRandom([2, 3, 3, 4]);
  for (let i = 0; i < notes && at < 3.6; i++) {
    index = Math.max(0, index + pickRandom([-2, -1, 1, 1, 2]));
    const note = octave + chord.scale[index % 7] + 12 * Math.floor(index / 7);
    INSTRUMENTS.piano(note, time + at * beat + humanise(), 0.05);
    at += pickRandom([0.5, 1, 1, 1.5]);
  }
}

function playBrushes(time, beat) {
  const ctx = /** @type {AudioContext} */ (engine.ctx);
  for (let i = 0; i < 8; i++) {
    if (i % 2 !== 0 && Math.random() >= 0.3) continue;
    const source = ctx.createBufferSource();
    source.buffer = engine.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 5200;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    const at = time + (i * beat) / 2 + (i % 2 ? beat * 0.08 : 0);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(i % 4 === 2 ? 0.014 : 0.006, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    source.connect(filter).connect(gain).connect(engine.nodes.music);
    source.start(at, rand(5), 0.25);
  }
}

/** Birdsong by day, cowbells in the distance, crickets on summer nights. */
function playAmbience(time) {
  const ctx = /** @type {AudioContext} */ (engine.ctx);
  const { phase, season } = musicContext();
  const n = engine.nodes;
  if (
    (phase === "dawn" || phase === "day") &&
    season !== "winter" &&
    Math.random() < 0.55
  ) {
    let pitch = rand(2600, 3800);
    let at = time;
    const chirps = 2 + Math.floor(rand(5));
    for (let i = 0; i < chirps; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(pitch, at);
      osc.frequency.exponentialRampToValueAtTime(
        pitch * rand(0.8, 1.25),
        at + 0.09,
      );
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(0.008, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(gain);
      gain.connect(n.ambienceSend);
      gain.connect(n.ambience);
      osc.start(at);
      osc.stop(at + 0.15);
      at += rand(0.1, 0.26);
      pitch *= rand(0.95, 1.05);
    }
  } else if (phase !== "night") {
    let at = time;
    const rings = 1 + Math.floor(rand(4));
    for (let i = 0; i < rings; i++) {
      [1, 2.76, 5.4].forEach((partial, k) =>
        tone(640 * partial, at, {
          duration: 0.9 - 0.2 * k,
          volume: 0.006 / (k + 1),
          destination: n.ambienceSend,
        }),
      );
      at += rand(0.4, 0.9);
    }
  } else if (season === "summer") {
    for (let i = 0; i < 7; i++) {
      tone(4300, time + i * 0.09, {
        duration: 0.05,
        volume: 0.0035,
        destination: n.ambience,
      });
    }
  }
}

export function setMusicEnabled(enabled) {
  audioSettings.music = enabled;
  const n = engine.nodes;
  if (!engine.ctx) return;
  n.music.gain.value = enabled ? 0.55 : 0;
  n.ambience.gain.value = enabled ? 0.5 : 0;
  n.reverbLevel.gain.value = enabled ? 2.2 : 0.5;
}

/**
 * A short sound effect.
 * @param {'click' | 'get' | 'hit' | 'miss' | 'chime' | 'build' | 'hiss' | 'meow'} name
 * @param {number} [variation] For 'hit': which note of the scale to play.
 */
export function playSound(name, variation = 0) {
  const ctx = engine.ctx;
  if (!ctx || !audioSettings.effects) return;
  const now = ctx.currentTime;
  const out = engine.nodes.effects;
  const blip = (
    frequency,
    delay,
    volume,
    type = /** @type {OscillatorType} */ ("sine"),
    duration = 0.2,
  ) =>
    tone(frequency, now + delay, { duration, volume, type, destination: out });

  switch (name) {
    case "click":
      blip(520, 0, 0.05, "sine", 0.08);
      break;
    case "get":
      blip(660, 0, 0.08, "sine", 0.25);
      blip(880, 0.09, 0.07, "sine", 0.35);
      break;
    case "hit":
      blip(midiToHz(72 + PENTATONIC[variation % 6]), 0, 0.12, "sine", 0.5);
      blip(midiToHz(84 + PENTATONIC[variation % 6]), 0, 0.03, "sine", 0.3);
      break;
    case "miss":
      blip(200, 0, 0.06, "sine", 0.16);
      break;
    case "chime":
      [0, 4, 7, 12].forEach((m, i) =>
        blip(midiToHz(72 + m), i * 0.13, 0.09, "sine", 1.2),
      );
      break;
    case "build":
      [0, 7, 12, 16].forEach((m, i) =>
        blip(midiToHz(60 + m), i * 0.15, 0.1, "triangle", 0.8),
      );
      break;
    case "hiss": {
      const source = ctx.createBufferSource();
      source.buffer = engine.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 3000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      source.connect(filter).connect(gain).connect(out);
      source.start(now, 0, 0.5);
      break;
    }
    case "meow": {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const base = rand(420, 620);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.linearRampToValueAtTime(base * 1.5, now + 0.12);
      osc.frequency.linearRampToValueAtTime(base * 0.8, now + 0.42);
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.linearRampToValueAtTime(1600, now + 0.15);
      filter.frequency.linearRampToValueAtTime(700, now + 0.42);
      filter.Q.value = 3;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
      osc.connect(filter).connect(gain).connect(out);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    }
    default:
      break;
  }
}

/** Turns the purring loop on or off. */
export function setPurring(on) {
  const ctx = engine.ctx;
  if (!ctx) return;
  if (on && !engine.purr) {
    const osc = ctx.createOscillator();
    const pulse = ctx.createOscillator();
    const pulseDepth = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = 46;
    filter.type = "lowpass";
    filter.frequency.value = 240;
    pulse.frequency.value = 24;
    pulseDepth.gain.value = 0.08;
    gain.gain.value = 0.09;
    pulse.connect(pulseDepth).connect(gain.gain);
    osc.connect(filter).connect(gain).connect(engine.nodes.effects);
    osc.start();
    pulse.start();
    engine.purr = {
      stop: () => {
        osc.stop();
        pulse.stop();
      },
    };
  } else if (!on && engine.purr) {
    engine.purr.stop();
    engine.purr = null;
  }
}
