// ❄️ 눈꽃 설산 맵 데이터
import type { Ramp } from "./world";

export const SNOW_SIZE = 140;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PEAK = { x: -60, z: -60, h: 30, r: 36 };
const HILLS = [
  PEAK,
  { x: 55, z: -85, h: 7, r: 16 },
  { x: -95, z: 60, h: 9, r: 20 },
  { x: 100, z: 105, h: 6, r: 14 },
];

/** 지형 높이 (언덕들) */
export function terrain(x: number, z: number): number {
  let h = 0;
  for (const p of HILLS) {
    const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
    h += p.h * Math.exp(-d2 / (2 * p.r * p.r));
  }
  return h;
}

export const LAKE = { x: 70, z: 50, rx: 24, rz: 16 };
export function onIce(x: number, z: number) {
  return ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2 < 1;
}

export const VILLAGE = { x: 75, z: -15 };
export const SPAWN_SNOW = { x: 60, z: -5, heading: -Math.PI / 2 };

// 슬라럼 코스: 정상 근처에서 아래로
const DIR = { x: Math.SQRT1_2, z: Math.SQRT1_2 }; // 내리막 방향
const PERP = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
const START = { x: -48, z: -48 };
export const SLALOM = Array.from({ length: 8 }, (_, i) => {
  const t = i * 7.5;
  const side = i === 0 || i === 7 ? 0 : i % 2 ? 1 : -1;
  return {
    x: START.x + DIR.x * t + PERP.x * side * 5,
    z: START.z + DIR.z * t + PERP.z * side * 5,
    heading: Math.atan2(DIR.x, DIR.z),
    w: i === 0 || i === 7 ? 9 : 6,
  };
});

// 리프트: 마을 쪽 승강장 → 정상
export const LIFT = {
  base: { x: 20, z: 20 },
  top: { x: -52, z: -52 },
  heading: Math.atan2(DIR.x, DIR.z),
};

// 스키점프 (코스 끝 근처, 내리막 방향)
const KICK = { x: 14, z: 14 };
export const SNOW_RAMPS: Ramp[] = [
  { x: KICK.x, z: KICK.z, rot: -Math.PI / 4, length: 9, width: 6, height: 2.8, color: "#90e0ef", hoop: 7 },
  { x: 95, z: 10, rot: Math.PI, length: 6, width: 4, height: 1.6, color: "#a2d2ff", hoop: 4.5 },
  { x: 40, z: 60, rot: -Math.PI / 2, length: 6, width: 4, height: 1.6, color: "#bde0fe", hoop: 4.5 },
  { x: -20, z: 80, rot: 0, length: 7, width: 5, height: 2, color: "#caf0f8", hoop: 5 },
];

const rand = mulberry32(777);

export interface SnowObj {
  x: number;
  z: number;
  s: number;
}

const keepOut = (x: number, z: number) => {
  if (onIce(x, z)) return true;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 26) return true;
  if (Math.hypot(x - LIFT.base.x, z - LIFT.base.z) < 8) return true;
  if (Math.hypot(x - LIFT.top.x, z - LIFT.top.z) < 9) return true;
  // 슬라럼 코스와 리프트 선 주변 비우기
  for (let t = 0; t <= 1; t += 0.05) {
    const lx = LIFT.base.x + (LIFT.top.x - LIFT.base.x) * t;
    const lz = LIFT.base.z + (LIFT.top.z - LIFT.base.z) * t;
    if (Math.hypot(x - lx, z - lz) < 10) return true;
  }
  if (SNOW_RAMPS.some((r) => Math.hypot(r.x - x, r.z - z) < r.length + 6)) return true;
  return false;
};

export const CABINS = [
  { x: VILLAGE.x - 12, z: VILLAGE.z - 8, rot: 0.3, c: "#9c6644" },
  { x: VILLAGE.x + 10, z: VILLAGE.z - 12, rot: -0.4, c: "#7f5539" },
  { x: VILLAGE.x + 14, z: VILLAGE.z + 8, rot: 2.6, c: "#b08968" },
  { x: VILLAGE.x - 8, z: VILLAGE.z + 14, rot: 2.9, c: "#9c6644" },
];
export const IGLOO = { x: VILLAGE.x + 2, z: VILLAGE.z + 20 };
export const SNOWMEN: SnowObj[] = [
  { x: VILLAGE.x, z: VILLAGE.z, s: 1.6 },
  { x: 48, z: 30, s: 1 },
  { x: 92, z: 72, s: 1.1 },
  { x: 30, z: -30, s: 1 },
  { x: LAKE.x - 26, z: LAKE.z - 6, s: 0.9 },
];

export const PINES: SnowObj[] = (() => {
  const out: SnowObj[] = [];
  let tries = 0;
  while (out.length < 130 && tries < 5000) {
    tries++;
    const x = (rand() * 2 - 1) * (SNOW_SIZE - 4);
    const z = (rand() * 2 - 1) * (SNOW_SIZE - 4);
    if (keepOut(x, z)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.9 });
  }
  return out;
})();
