"use client";

/**
 * Small UI sound kit, synthesised with Web Audio -- no audio files to load,
 * nothing to cache, and it works offline inside the app shell.
 *
 * Every sound is short and soft (UI feedback, not music). Users can switch
 * them off in Settings (`setSoundsEnabled(false)`); the choice is kept per
 * device. Calls never throw.
 */

export type SoundName =
  | "success" // posted / done: bright two-note chime
  | "coins" // credits added: sparkly ascending ticks
  | "unlock" // PIN accepted: soft click + rise
  | "scan" // QR recognised: quick double blip
  | "send" // chat message sent: soft whoosh-pop
  | "receive" // chat message arrived: gentle pluck
  | "pop" // reaction / small confirmation
  | "error"; // something failed: low double buzz

const PREF_KEY = "xivago:sounds";
let ctx: AudioContext | null = null;

export function soundsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // ignore
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  freq: number;
  /** Optional glide target. */
  to?: number;
  start: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function play(tones: Tone[], master = 0.22) {
  const ac = audio();
  if (!ac) return;
  const out = ac.createGain();
  out.gain.value = master;
  out.connect(ac.destination);
  const t0 = ac.currentTime + 0.01;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, t0 + t.start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, t0 + t.start + t.dur);
    const peak = t.gain ?? 1;
    g.gain.setValueAtTime(0.0001, t0 + t.start);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.start + t.dur);
    osc.connect(g).connect(out);
    osc.start(t0 + t.start);
    osc.stop(t0 + t.start + t.dur + 0.05);
  }
}

function noiseWhoosh(dur = 0.18, gain = 0.12) {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(3200, ac.currentTime + dur);
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

export function playSound(name: SoundName) {
  if (!soundsEnabled()) return;
  try {
    switch (name) {
      case "success":
        play([
          { freq: 784, start: 0, dur: 0.18, type: "triangle" }, // G5
          { freq: 1175, start: 0.1, dur: 0.32, type: "triangle" }, // D6
          { freq: 1568, start: 0.1, dur: 0.4, type: "sine", gain: 0.35 }, // G6 shimmer
        ]);
        break;
      case "coins":
        play(
          [0, 0.07, 0.14, 0.21, 0.3].map((start, i) => ({
            freq: [1318, 1568, 1760, 2093, 2637][i]!,
            start,
            dur: 0.16,
            type: "square" as OscillatorType,
            gain: 0.18,
          })),
          0.28,
        );
        break;
      case "unlock":
        play([
          { freq: 220, start: 0, dur: 0.05, type: "square", gain: 0.3 },
          { freq: 523, to: 1046, start: 0.06, dur: 0.22, type: "triangle" },
        ]);
        break;
      case "scan":
        play([
          { freq: 1760, start: 0, dur: 0.07, type: "square", gain: 0.25 },
          { freq: 2349, start: 0.09, dur: 0.12, type: "square", gain: 0.25 },
        ]);
        break;
      case "send":
        noiseWhoosh(0.14, 0.06);
        play([{ freq: 660, to: 990, start: 0.04, dur: 0.1, type: "sine", gain: 0.6 }], 0.16);
        break;
      case "receive":
        play([
          { freq: 988, start: 0, dur: 0.12, type: "sine" },
          { freq: 1319, start: 0.08, dur: 0.18, type: "sine", gain: 0.7 },
        ], 0.14);
        break;
      case "pop":
        play([{ freq: 520, to: 880, start: 0, dur: 0.09, type: "sine" }], 0.18);
        break;
      case "error":
        play([
          { freq: 196, start: 0, dur: 0.12, type: "sawtooth", gain: 0.35 },
          { freq: 165, start: 0.14, dur: 0.18, type: "sawtooth", gain: 0.35 },
        ], 0.16);
        break;
    }
  } catch {
    // never let a sound break the UI
  }
}
