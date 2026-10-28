// Short UI sounds synthesised with Web Audio: no file to load, works offline. Kept soft and brief:
// a fair is noisy, and the stand plays them all day long.

const MUTE_KEY = 'studio-media:muted'; // the stand staff's choice, kept across visitors

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  // storage blocked: sound stays on
}

/** The audio context can only start after a gesture: called on the first tap. */
function audio(): AudioContext {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

/** One enveloped oscillator note. `at`: delay in seconds. */
interface ToneOptions {
  at?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  slide?: number;
}

function tone(frequency: number, { at = 0, duration = 0.12, type = 'sine', gain = 0.2, slide = 0 }: ToneOptions = {}): void {
  const ctx = audio();
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(frequency * slide, start + duration);
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(env).connect(master!);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Filtered white noise burst (camera shutter). */
function noise({ at = 0, duration = 0.05, frequency = 2500, gain = 0.25 }: { at?: number; duration?: number; frequency?: number; gain?: number } = {}): void {
  const ctx = audio();
  const start = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  const env = ctx.createGain();
  env.gain.value = gain;
  source.connect(filter).connect(env).connect(master!);
  source.start(start);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

const SOUNDS = {
  tap: () => tone(880, { duration: 0.07, gain: 0.08, slide: 1.25 }),
  pop: () => tone(620, { duration: 0.12, gain: 0.12, slide: 1.6, type: 'triangle' }),
  tick: () => tone(1200, { duration: 0.04, gain: 0.06, type: 'square' }),
  shutter: () => {
    noise({ duration: 0.035, frequency: 3200, gain: 0.35 });
    noise({ at: 0.07, duration: 0.05, frequency: 1800, gain: 0.25 });
  },
  oops: () => {
    tone(440, { duration: 0.16, gain: 0.12, type: 'triangle', slide: 0.9 });
    tone(330, { at: 0.15, duration: 0.24, gain: 0.12, type: 'triangle', slide: 0.9 });
  },
  star: () => [C6, E6, G6].forEach((f, i) => tone(f, { at: i * 0.07, duration: 0.22, gain: 0.12, type: 'triangle' })),
  sparkle: () => [G6, E6, C6 * 2, G6].forEach((f, i) => tone(f, { at: i * 0.05, duration: 0.15, gain: 0.07 })),
  fanfare: () => {
    [C5, E5, G5].forEach((f, i) => tone(f, { at: i * 0.12, duration: 0.18, gain: 0.14, type: 'triangle' }));
    [C5, E5, G5, C6].forEach((f) => tone(f, { at: 0.38, duration: 0.9, gain: 0.08, type: 'triangle' }));
  },
};

export type SoundName = keyof typeof SOUNDS;

export const sound = {
  play(name: SoundName): void {
    if (muted) return;
    try {
      SOUNDS[name]();
    } catch {
      // no audio device: the game goes on silently
    }
  },

  get muted(): boolean {
    return muted;
  },

  setMuted(value: boolean): void {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      // storage blocked: the choice lasts until the next visitor
    }
  },
};
