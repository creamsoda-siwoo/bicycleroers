// 🏜️ 노을 사막 협곡 맵 데이터
import type { Obstacle, Ramp } from "./world";

export const DESERT_SIZE = 140;
export const ROAD_HALF = 4.5;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 협곡 랠리 길 (출발 → 결승)
const CTRL: [number, number][] = [
  [-118, -112], [-85, -118], [-50, -100], [-32, -66], [-52, -32], [-78, 0], [-60, 34],
  [-22, 44], [12, 22], [42, 0], [80, 8], [108, 40], [96, 80], [62, 98], [22, 112], [-22, 116],
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** 길 위의 점들 (약 2m 간격) */
export const ROAD: { x: number; z: number; h: number; s: number }[] = (() => {
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < CTRL.length - 1; i++) {
    const p0 = CTRL[Math.max(0, i - 1)];
    const p1 = CTRL[i];
    const p2 = CTRL[i + 1];
    const p3 = CTRL[Math.min(CTRL.length - 1, i + 2)];
    const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(4, Math.ceil(segLen / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push({ x: catmull(p0[0], p1[0], p2[0], p3[0], t), z: catmull(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  pts.push({ x: CTRL[CTRL.length - 1][0], z: CTRL[CTRL.length - 1][1] });
  let s = 0;
  return pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)];
    const r = pts[Math.max(0, i - 1)];
    if (i > 0) s += Math.hypot(p.x - r.x, p.z - r.z);
    return { x: p.x, z: p.z, h: Math.atan2(q.x - r.x, q.z - r.z), s };
  });
})();

export const ROAD_LENGTH = ROAD[ROAD.length - 1].s;

/** 길 위 특정 거리의 점 */
export function roadAt(s: number) {
  let i = ROAD.findIndex((p) => p.s >= s);
  if (i < 0) i = ROAD.length - 1;
  return ROAD[i];
}

// 협곡 틈 (점프로 넘어야 함): 길의 58% 지점을 가로지르는 골짜기
const GAP_AT = roadAt(ROAD_LENGTH * 0.58);
export const GAP = { x: GAP_AT.x, z: GAP_AT.z, h: GAP_AT.h, half: 4.2, depth: 4, reach: 14 };

function gapDepth(x: number, z: number) {
  const dx = x - GAP.x;
  const dz = z - GAP.z;
  // along: 길 방향 거리, across: 골짜기 따라 거리
  const along = dx * Math.sin(GAP.h) + dz * Math.cos(GAP.h);
  const across = dx * Math.cos(GAP.h) - dz * Math.sin(GAP.h);
  const a = Math.abs(along);
  if (a > GAP.half + 1.5) return 0;
  const wall = a < GAP.half ? 1 : 1 - (a - GAP.half) / 1.5;
  const ends = Math.max(0, Math.min(1, (GAP.reach + 8 - Math.abs(across)) / 8));
  return GAP.depth * wall * ends;
}

// ── 길까지 거리: 2m 격자에 미리 계산 ──
const CELL = 2;
const N = Math.ceil((DESERT_SIZE * 2 + 40) / CELL) + 1;
const ORIGIN = -(DESERT_SIZE + 20);
let fieldCache: Float32Array | null = null;
function buildField(): Float32Array {
  const f = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = ORIGIN + i * CELL;
      const z = ORIGIN + j * CELL;
      let best = 1e9;
      for (let k = 0; k < ROAD.length - 1; k++) {
        const a = ROAD[k];
        const b = ROAD[k + 1];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const l2 = vx * vx + vz * vz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
        const d = Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t));
        if (d < best) best = d;
      }
      f[j * N + i] = best;
    }
  }
  return f;
}

export function roadDist(x: number, z: number) {
  const field = fieldCache ?? (fieldCache = buildField());
  const fx = (x - ORIGIN) / CELL;
  const fz = (z - ORIGIN) / CELL;
  const i = Math.max(0, Math.min(N - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(N - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - i));
  const tz = Math.max(0, Math.min(1, fz - j));
  const a = field[j * N + i];
  const b = field[j * N + i + 1];
  const c = field[(j + 1) * N + i];
  const d = field[(j + 1) * N + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

export const OASIS = { x: 40, z: 62, r: 9 };
export function inOasis(x: number, z: number) {
  return Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r;
}

/** 지형: 길은 평평, 길에서 멀수록 모래 언덕 */
export function desertTerrain(x: number, z: number): number {
  const d = roadDist(x, z);
  const away = Math.max(0, Math.min(1, (d - ROAD_HALF - 1) / 12));
  const dunes = (Math.sin(x * 0.07 + Math.cos(z * 0.05) * 2) * 0.5 + 0.5) * 2.6 + (Math.sin(z * 0.11 + x * 0.03) * 0.5 + 0.5) * 1.4;
  let h = dunes * away;
  h -= gapDepth(x, z);
  if (inOasis(x, z)) h = -0.45;
  return h;
}

export const onRoad = (x: number, z: number) => roadDist(x, z) < ROAD_HALF;

// 점프대: 협곡 틈 바로 앞 + 길 곳곳
function rampAt(s: number, len: number, height: number, color: string, hoop?: number, back = 0): Ramp {
  const p = roadAt(s);
  // 오르막 방향 = 길 진행 방향 → rot 계산 (up = (cos rot, -sin rot))
  const dx = Math.sin(p.h);
  const dz = Math.cos(p.h);
  return {
    x: p.x - dx * back,
    z: p.z - dz * back,
    rot: Math.atan2(-dz, dx),
    length: len,
    width: ROAD_HALF * 2 - 1,
    height,
    color,
    hoop,
  };
}

export const DESERT_RAMPS: Ramp[] = [
  rampAt(ROAD_LENGTH * 0.58, 8, 1.8, "#e76f51", 5.5, GAP.half + 4.2),
  rampAt(ROAD_LENGTH * 0.2, 6, 1.3, "#f4a261", 4),
  rampAt(ROAD_LENGTH * 0.82, 6, 1.4, "#e9c46a", 4.2),
];

// 코스 게이트: 출발, 중간 체크포인트, 결승
export const DESERT_GATES = Array.from({ length: 10 }, (_, i) => {
  const p = roadAt(i === 0 ? 6 : i === 9 ? ROAD_LENGTH - 4 : (ROAD_LENGTH * i) / 9);
  return { x: p.x, z: p.z, heading: p.h, w: ROAD_HALF * 2 + 2 };
});

export const DESERT_SPAWN = (() => {
  const p = ROAD[0];
  return { x: p.x, z: p.z, heading: p.h };
})();

const rand = mulberry32(4242);

export const TOWN = { x: -92, z: -72 };

export interface Mesa {
  x: number;
  z: number;
  r: number;
  h: number;
}

/** 길 양옆의 바위 기둥(메사) — 협곡 느낌 */
export const MESAS: Mesa[] = (() => {
  const out: Mesa[] = [];
  let tries = 0;
  while (out.length < 34 && tries < 4000) {
    tries++;
    const p = ROAD[Math.floor(rand() * ROAD.length)];
    const side = rand() < 0.5 ? -1 : 1;
    const off = ROAD_HALF + 9 + rand() * 14;
    const x = p.x + Math.cos(p.h) * side * off;
    const z = p.z - Math.sin(p.h) * side * off;
    const r = 4 + rand() * 6;
    if (Math.abs(x) > DESERT_SIZE - 6 || Math.abs(z) > DESERT_SIZE - 6) continue;
    if (roadDist(x, z) < r + ROAD_HALF + 3) continue;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < 22 || Math.hypot(x - OASIS.x, z - OASIS.z) < OASIS.r + r + 6) continue;
    if (Math.hypot(x - GAP.x, z - GAP.z) < GAP.reach + r + 6) continue;
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + r + 3)) continue;
    out.push({ x, z, r, h: 9 + rand() * 16 });
  }
  return out;
})();

export const CACTI: { x: number; z: number; s: number }[] = (() => {
  const out: { x: number; z: number; s: number }[] = [];
  let tries = 0;
  while (out.length < 70 && tries < 5000) {
    tries++;
    const x = (rand() * 2 - 1) * (DESERT_SIZE - 5);
    const z = (rand() * 2 - 1) * (DESERT_SIZE - 5);
    if (roadDist(x, z) < ROAD_HALF + 3) continue;
    if (MESAS.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + 2)) continue;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < 20 || inOasis(x, z)) continue;
    if (Math.hypot(x - GAP.x, z - GAP.z) < GAP.reach + 4) continue;
    if (out.some((c) => Math.hypot(c.x - x, c.z - z) < 5)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.7 });
  }
  return out;
})();

export const ADOBES = [
  { x: TOWN.x - 9, z: TOWN.z - 6, w: 7, d: 6, h: 3.4, c: "#e9b384" },
  { x: TOWN.x + 7, z: TOWN.z - 9, w: 6, d: 6, h: 4.4, c: "#d4a373" },
  { x: TOWN.x + 10, z: TOWN.z + 6, w: 8, d: 5, h: 3, c: "#e6b17e" },
  { x: TOWN.x - 6, z: TOWN.z + 10, w: 6, d: 7, h: 3.8, c: "#cc9f6d" },
];

export const PALMS = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 + 0.3;
  return { x: OASIS.x + Math.cos(a) * (OASIS.r + 2.5), z: OASIS.z + Math.sin(a) * (OASIS.r + 2.5), s: 0.9 + (i % 3) * 0.15 };
});

export const DESERT_OBSTACLES: Obstacle[] = [
  ...MESAS.map((m) => ({ x: m.x, z: m.z, r: m.r })),
  ...CACTI.map((c) => ({ x: c.x, z: c.z, r: 0.5 * c.s })),
  ...ADOBES.map((a) => ({ x: a.x, z: a.z, r: Math.max(a.w, a.d) * 0.55 })),
  ...PALMS.map((p) => ({ x: p.x, z: p.z, r: 0.4 })),
];
