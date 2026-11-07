// 월드 데이터: 지형 높이, 장애물, 별 위치 — 렌더링과 물리에서 함께 사용

export const WORLD_SIZE = 140; // 이동 가능 반경(정사각형 절반)
export const TRACK_RADIUS = 60;
export const TRACK_WIDTH = 9;
export const PLAZA_RADIUS = 15;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Ramp {
  x: number;
  z: number;
  /** y축 회전 (오르막 방향 = 로컬 +x) */
  rot: number;
  length: number;
  width: number;
  height: number;
  color: string;
  /** 점프대 앞 공중 링 높이 (없으면 링 없음) */
  hoop?: number;
}

/** 평평한 단 (펀박스, 다리 상판) */
export interface Platform {
  x: number;
  z: number;
  w: number; // x 방향
  d: number; // z 방향
  h: number;
  color: string;
}

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface Tree {
  x: number;
  z: number;
  scale: number;
  kind: "pine" | "round" | "blossom";
  color: string;
}

export interface House {
  x: number;
  z: number;
  rot: number;
  w: number;
  d: number;
  h: number;
  wall: string;
  roof: string;
}

// ── 특별 구역 ──
export const SKATE = { x: -100, z: 0, r: 26 };
export const POND = { x: 0, z: 102, r: 12 };
export const BRIDGE = { x: 0, z: 102, len: 24, width: 5, h: 2.2 };
export const FERRIS = { x: 100, z: -95, r: 10 };
export const WINDMILLS = [
  { x: -108, z: 98 },
  { x: 112, z: 92 },
];

/** 나무·집이 들어가면 안 되는 영역 */
const ZONES = [
  { x: SKATE.x, z: SKATE.z, r: SKATE.r + 12 },
  { x: SKATE.x, z: SKATE.z - 34, r: 8 },
  { x: POND.x, z: POND.z, r: 26 },
  { x: FERRIS.x, z: FERRIS.z, r: 14 },
  ...WINDMILLS.map((w) => ({ x: w.x, z: w.z, r: 7 })),
];
const inZone = (x: number, z: number, pad = 0) =>
  ZONES.some((zn) => Math.hypot(zn.x - x, zn.z - z) < zn.r + pad);

export const PLATFORMS: Platform[] = [
  // 스케이트파크 펀박스
  { x: SKATE.x, z: SKATE.z + 4, w: 8, d: 6, h: 1.2, color: "#adb5bd" },
  // 무지개 다리 상판
  { x: BRIDGE.x, z: BRIDGE.z, w: BRIDGE.len, d: BRIDGE.width, h: BRIDGE.h, color: "#c08552" },
];

// 트랙 위 점프대 (진행 방향과 나란하게) + 들판 점프대
export const RAMPS: Ramp[] = [
  ...[0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    // 트랙 접선 방향(반시계)으로 오르막
    const tx = -Math.sin(a);
    const tz = Math.cos(a);
    return {
      x: Math.cos(a) * TRACK_RADIUS,
      z: Math.sin(a) * TRACK_RADIUS,
      rot: Math.atan2(-tz, tx),
      length: 6,
      width: 4,
      height: 1.4,
      color: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe"][i],
      hoop: 3.2,
    } as Ramp;
  }),
  { x: 25, z: -25, rot: 0.6, length: 8, width: 5, height: 2.2, color: "#ff9f1c", hoop: 4.2 },
  { x: -30, z: 28, rot: 2.4, length: 8, width: 5, height: 2.2, color: "#2ec4b6", hoop: 4.2 },
  { x: 95, z: 10, rot: -1.2, length: 10, width: 6, height: 3, color: "#e71d36", hoop: 5.5 },
  // ── 스케이트파크 ──
  // 펀박스 4면 경사로
  { x: SKATE.x, z: SKATE.z - 1.5, rot: -Math.PI / 2, length: 5, width: 8, height: 1.2, color: "#ced4da" },
  { x: SKATE.x, z: SKATE.z + 9.5, rot: Math.PI / 2, length: 5, width: 8, height: 1.2, color: "#ced4da" },
  { x: SKATE.x - 6.5, z: SKATE.z + 4, rot: 0, length: 5, width: 6, height: 1.2, color: "#ced4da" },
  { x: SKATE.x + 6.5, z: SKATE.z + 4, rot: Math.PI, length: 5, width: 6, height: 1.2, color: "#ced4da" },
  // 킥커
  { x: SKATE.x + 15, z: SKATE.z + 10, rot: 0, length: 5, width: 4, height: 1.7, color: "#ff006e", hoop: 4.5 },
  { x: SKATE.x - 15, z: SKATE.z + 10, rot: Math.PI, length: 5, width: 4, height: 1.7, color: "#3a86ff", hoop: 4.5 },
  // 메가 램프 (바깥쪽으로 날아감)
  { x: SKATE.x, z: SKATE.z - 18, rot: Math.PI / 2, length: 12, width: 6, height: 4, color: "#fb5607", hoop: 7.5 },
  // ── 무지개 다리 양쪽 경사로 ──
  { x: BRIDGE.x - BRIDGE.len / 2 - 4, z: BRIDGE.z, rot: 0, length: 8, width: BRIDGE.width, height: BRIDGE.h, color: "#c08552" },
  { x: BRIDGE.x + BRIDGE.len / 2 + 4, z: BRIDGE.z, rot: Math.PI, length: 8, width: BRIDGE.width, height: BRIDGE.h, color: "#c08552" },
];

/** 점프대 끝 앞의 공중 링 */
export const HOOPS = RAMPS.filter((r) => r.hoop).map((r) => {
  const dx = Math.cos(r.rot);
  const dz = -Math.sin(r.rot);
  const ahead = r.length / 2 + 3 + r.height * 1.5;
  return {
    x: r.x + dx * ahead,
    z: r.z + dz * ahead,
    y: r.hoop!,
    face: Math.atan2(dx, dz),
    r: 1.9,
  };
});

/** 트랙 위 부스터 */
export const BOOSTS = [0, 1, 2, 3].map((k) => {
  const a = (k * Math.PI) / 2 + 0.35;
  return {
    x: Math.cos(a) * TRACK_RADIUS,
    z: Math.sin(a) * TRACK_RADIUS,
    // 진행 방향(반시계) 접선 각도 (heading 기준)
    heading: Math.atan2(-Math.sin(a), Math.cos(a)),
    a,
  };
});

/** 트랙 바깥쪽 가로등 */
export const LAMPS = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
  const r = TRACK_RADIUS + TRACK_WIDTH / 2 + 1.3;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
});

const rand = mulberry32(20261106);

export const HOUSES: House[] = (() => {
  const list: House[] = [];
  const walls = ["#fff1e6", "#fde2e4", "#e2ece9", "#dfe7fd", "#fff8b8"];
  const roofs = ["#e76f51", "#457b9d", "#2a9d8f", "#b5838d", "#f4a261"];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const r = TRACK_RADIUS + 22 + rand() * 18;
    if (inZone(Math.cos(a) * r, Math.sin(a) * r, 5)) continue;
    list.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      rot: -a + Math.PI / 2,
      w: 5 + rand() * 3,
      d: 5 + rand() * 3,
      h: 3 + rand() * 2,
      wall: walls[i % walls.length],
      roof: roofs[(i * 3) % roofs.length],
    });
  }
  return list;
})();

function nearRamp(x: number, z: number, pad: number) {
  return RAMPS.some((r) => Math.hypot(r.x - x, r.z - z) < r.length / 2 + pad);
}

export const TREES: Tree[] = (() => {
  const list: Tree[] = [];
  const greens = ["#52b788", "#40916c", "#74c69d", "#2d6a4f", "#95d5b2"];
  let tries = 0;
  while (list.length < 110 && tries < 4000) {
    tries++;
    const x = (rand() * 2 - 1) * (WORLD_SIZE - 5);
    const z = (rand() * 2 - 1) * (WORLD_SIZE - 5);
    const d = Math.hypot(x, z);
    if (Math.abs(d - TRACK_RADIUS) < TRACK_WIDTH / 2 + 3) continue;
    if (d < PLAZA_RADIUS + 4) continue;
    if (nearRamp(x, z, 5)) continue;
    if (inZone(x, z, 2)) continue;
    if (HOUSES.some((h) => Math.hypot(h.x - x, h.z - z) < 7)) continue;
    if (list.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    list.push({
      x,
      z,
      scale: 0.8 + rand() * 0.8,
      kind: (() => {
        const k = rand();
        return k < 0.4 ? "pine" : k < 0.75 ? "round" : "blossom";
      })(),
      color: greens[Math.floor(rand() * greens.length)],
    });
  }
  return list;
})();

export const OBSTACLES: Obstacle[] = [
  { x: 0, z: 0, r: 4.2 }, // 분수대
  { x: FERRIS.x - 3, z: FERRIS.z, r: 1.2 },
  { x: FERRIS.x + 3, z: FERRIS.z, r: 1.2 },
  { x: FERRIS.x, z: FERRIS.z + 3, r: 2.2 },
  ...WINDMILLS.map((w) => ({ x: w.x, z: w.z, r: 2.6 })),
  ...LAMPS.map((l) => ({ x: l.x, z: l.z, r: 0.25 })),
  ...TREES.map((t) => ({ x: t.x, z: t.z, r: 0.6 * t.scale })),
  ...HOUSES.map((h) => ({ x: h.x, z: h.z, r: Math.max(h.w, h.d) * 0.6 })),
];

export function inPond(x: number, z: number) {
  return Math.hypot(x - POND.x, (z - POND.z) * 1.4) < POND.r;
}

/** (x, z) 위치의 지면 높이 */
export function groundHeight(x: number, z: number): number {
  let h = inPond(x, z) ? -0.45 : 0;
  for (const p of PLATFORMS) {
    if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) h = Math.max(h, p.h);
  }
  for (const r of RAMPS) {
    const dx = x - r.x;
    const dz = z - r.z;
    const c = Math.cos(r.rot);
    const s = Math.sin(r.rot);
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    if (Math.abs(u) <= r.length / 2 && Math.abs(v) <= r.width / 2) {
      h = Math.max(h, (r.height * (u + r.length / 2)) / r.length);
    }
  }
  return h;
}

/** 장애물과 경계 밖으로 밀어내기 */
export function resolveCollisions(p: { x: number; z: number }, radius = 0.5) {
  for (const o of OBSTACLES) {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + radius;
    if (d < min && d > 0.0001) {
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
    }
  }
  p.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, p.x));
  p.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, p.z));
}

// 별(수집 아이템) — 클라이언트마다 개별
export const STAR_COUNT = 30;
const starRand = mulberry32(Date.now() % 100000);

export function randomStarPos(): [number, number] {
  for (let i = 0; i < 50; i++) {
    // 절반은 트랙 위, 절반은 들판
    let x: number, z: number;
    if (starRand() < 0.5) {
      const a = starRand() * Math.PI * 2;
      const r = TRACK_RADIUS + (starRand() - 0.5) * (TRACK_WIDTH - 2);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } else {
      x = (starRand() * 2 - 1) * (WORLD_SIZE - 10);
      z = (starRand() * 2 - 1) * (WORLD_SIZE - 10);
    }
    if (OBSTACLES.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5)) continue;
    if (inPond(x, z)) continue;
    return [x, z];
  }
  return [10, 10];
}

export const SPAWN = { x: -9, z: -TRACK_RADIUS + 0.7, heading: Math.PI / 2 };
