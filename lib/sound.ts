// 효과음: 파일 없이 WebAudio로 합성
export type Sfx =
  | "jump" | "star" | "ring" | "trick" | "crash" | "boost" | "splash" | "bell"
  | "checkpoint" | "finish" | "buy" | "lift" | "land";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("bicycleroers-muted") === "1";
} catch {
  /* 무시 */
}

export const isMuted = () => muted;

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem("bicycleroers-muted", m ? "1" : "0");
  } catch {
    /* 무시 */
  }
  if (master) master.gain.value = m ? 0 : 0.5;
}

/** 사용자 입력 후 호출해서 오디오 잠금 해제 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.3, slideTo?: number) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.3, freq = 1200) {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(start);
}

/** volume: 0~1 (먼 곳의 소리는 작게) */
export function sfx(name: Sfx, volume = 1) {
  if (muted || !ctx || volume <= 0.02) return;
  const t = ctx.currentTime;
  const v = Math.min(1, volume);
  switch (name) {
    case "jump": tone(320, t, 0.18, "square", 0.12 * v, 640); break;
    case "land": noise(t, 0.08, 0.15 * v, 300); break;
    case "star": tone(988, t, 0.09, "triangle", 0.25 * v); tone(1319, t + 0.07, 0.16, "triangle", 0.25 * v); break;
    case "ring": [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.18, "triangle", 0.22 * v)); break;
    case "trick": [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.22, "square", 0.1 * v)); break;
    case "crash": noise(t, 0.35, 0.5 * v, 500); tone(180, t, 0.3, "sawtooth", 0.15 * v, 60); break;
    case "boost": tone(200, t, 0.5, "sawtooth", 0.12 * v, 900); break;
    case "splash": noise(t, 0.5, 0.4 * v, 1800); break;
    case "bell":
      for (const k of [0, 0.22]) {
        tone(2093, t + k, 0.35, "sine", 0.25 * v);
        tone(2637, t + k, 0.3, "sine", 0.15 * v);
      }
      break;
    case "checkpoint": tone(880, t, 0.12, "square", 0.12 * v); tone(1175, t + 0.1, 0.18, "square", 0.12 * v); break;
    case "finish": [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.25, "triangle", 0.25 * v)); break;
    case "buy": tone(1047, t, 0.1, "triangle", 0.25 * v); tone(1568, t + 0.08, 0.25, "triangle", 0.25 * v); break;
    case "lift": tone(300, t, 0.6, "sine", 0.2 * v, 900); break;
  }
}

// ── 연속 소리 (바람, 미끄러짐) ──
interface Loop {
  gain: GainNode;
  filter: BiquadFilterNode;
}
const loops: Record<string, Loop> = {};

function loop(name: string, freq: number, type: BiquadFilterType, q = 0.7): Loop | null {
  if (!ctx || !master) return null;
  if (loops[name]) return loops[name];
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  loops[name] = { gain, filter };
  return loops[name];
}

/** 0~1: 속도에 따른 바람 소리 */
export function setWind(level: number) {
  const l = loop("wind", 500, "lowpass");
  if (!l || !ctx) return;
  const v = muted ? 0 : Math.max(0, Math.min(1, level)) ** 2 * 0.22;
  l.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.15);
  l.filter.frequency.setTargetAtTime(300 + level * 900, ctx.currentTime, 0.2);
}

/** 0~1: 타이어 미끄러지는 소리 */
export function setSkid(level: number) {
  const l = loop("skid", 2600, "bandpass", 3);
  if (!l || !ctx) return;
  const v = muted ? 0 : Math.max(0, Math.min(1, level)) * 0.25;
  l.gain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}
