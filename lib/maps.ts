// 맵 선택과 공통 지형/충돌 함수
import * as V from "./world";
import * as S from "./snow";
import * as D from "./desert";

export type MapId = "village" | "snow" | "desert";

export interface Gate {
  x: number;
  z: number;
  heading: number;
  w: number;
}

export interface Hoop {
  x: number;
  y: number;
  z: number;
  face: number;
  r: number;
}

export interface MapDef {
  id: MapId;
  name: string;
  emoji: string;
  desc: string;
  size: number;
  spawn: { x: number; z: number; heading: number };
  ramps: V.Ramp[];
  platforms: V.Platform[];
  obstacles: V.Obstacle[];
  hoops: Hoop[];
  boosts: { x: number; z: number; heading: number }[];
  base: (x: number, z: number) => number;
  paved: (x: number, z: number) => boolean;
  water: (x: number, z: number) => boolean;
  ice: (x: number, z: number) => boolean;
  /** lap: 출발선(0번)으로 돌아오면 한 바퀴 / run: 마지막 게이트가 결승 */
  course: { kind: "lap" | "run"; name: string; gates: Gate[] };
  lift?: { x: number; z: number; r: number; to: { x: number; z: number; heading: number } };
  sky: { bg: string; fog: [number, number]; hemi: [string, string, number]; sun: number; sunColor: string };
}

function hoopsFrom(ramps: V.Ramp[], base: (x: number, z: number) => number): Hoop[] {
  return ramps.filter((r) => r.hoop).map((r) => {
    const dx = Math.cos(r.rot);
    const dz = -Math.sin(r.rot);
    const ahead = r.length / 2 + 3 + r.height * 1.5;
    const x = r.x + dx * ahead;
    const z = r.z + dz * ahead;
    return { x, z, y: r.hoop! + base(x, z), face: Math.atan2(dx, dz), r: 1.9 };
  });
}

const village: MapDef = {
  id: "village",
  name: "무지개 마을",
  emoji: "🏘️",
  desc: "트랙·스케이트파크·무지개 다리·관람차",
  size: V.WORLD_SIZE,
  spawn: V.SPAWN,
  ramps: V.RAMPS,
  platforms: V.PLATFORMS,
  obstacles: V.OBSTACLES,
  hoops: V.HOOPS,
  boosts: V.BOOSTS,
  base: (x, z) => (V.inPond(x, z) ? -0.45 : 0),
  paved: (x, z) => {
    const d = Math.hypot(x, z);
    if (Math.abs(d - V.TRACK_RADIUS) < V.TRACK_WIDTH / 2) return true;
    if (d < V.PLAZA_RADIUS) return true;
    if (Math.hypot(x - V.SKATE.x, z - V.SKATE.z) < V.SKATE.r) return true;
    if ((Math.abs(x) < 2 || Math.abs(z) < 2) && d < V.TRACK_RADIUS) return true;
    return false;
  },
  water: V.inPond,
  ice: () => false,
  sky: { bg: "#bde0fe", fog: [90, 260], hemi: ["#ffffff", "#7fb069", 1.1], sun: 2.2, sunColor: "#ffffff" },
  course: {
    kind: "lap",
    name: "트랙 한 바퀴",
    gates: [-Math.PI / 2, 0, Math.PI / 2, Math.PI].map((a) => ({
      x: Math.cos(a) * V.TRACK_RADIUS,
      z: Math.sin(a) * V.TRACK_RADIUS,
      heading: Math.atan2(-Math.sin(a), Math.cos(a)),
      w: V.TRACK_WIDTH + 1,
    })),
  },
};

const snowObstacles: V.Obstacle[] = [
  ...S.PINES.map((t) => ({ x: t.x, z: t.z, r: 0.7 * t.s })),
  ...S.SNOWMEN.map((m) => ({ x: m.x, z: m.z, r: 0.75 * m.s })),
  ...S.CABINS.map((c) => ({ x: c.x, z: c.z, r: 3.6 })),
  { x: S.IGLOO.x, z: S.IGLOO.z, r: 3.2 },
];

const snow: MapDef = {
  id: "snow",
  name: "눈꽃 설산",
  emoji: "❄️",
  desc: "리프트·슬라럼·스키점프·얼음 호수·오로라",
  size: S.SNOW_SIZE,
  spawn: S.SPAWN_SNOW,
  ramps: S.SNOW_RAMPS,
  platforms: [],
  obstacles: snowObstacles,
  hoops: hoopsFrom(S.SNOW_RAMPS, S.terrain),
  boosts: [],
  base: S.terrain,
  paved: (x, z) => Math.hypot(x - S.VILLAGE.x, z - S.VILLAGE.z) < 22 || S.onIce(x, z),
  water: () => false,
  ice: S.onIce,
  course: { kind: "run", name: "슬라럼 다운힐", gates: S.SLALOM },
  sky: { bg: "#2c3e6b", fog: [70, 240], hemi: ["#cfe3ff", "#ffffff", 0.95], sun: 1.5, sunColor: "#dbe7ff" },
  lift: { x: S.LIFT.base.x, z: S.LIFT.base.z, r: 2.6, to: { ...S.LIFT.top, heading: S.LIFT.heading } },
};

const desert: MapDef = {
  id: "desert",
  name: "노을 사막 협곡",
  emoji: "🏜️",
  desc: "구불구불 협곡 랠리·협곡 점프·모래 언덕·오아시스",
  size: D.DESERT_SIZE,
  spawn: D.DESERT_SPAWN,
  ramps: D.DESERT_RAMPS,
  platforms: [],
  obstacles: D.DESERT_OBSTACLES,
  hoops: hoopsFrom(D.DESERT_RAMPS, D.desertTerrain),
  boosts: [0.12, 0.35, 0.47, 0.7, 0.9].map((k) => {
    const p = D.roadAt(D.ROAD_LENGTH * k);
    return { x: p.x, z: p.z, heading: p.h };
  }),
  base: D.desertTerrain,
  paved: (x, z) => D.onRoad(x, z) || Math.hypot(x - D.TOWN.x, z - D.TOWN.z) < 18,
  water: D.inOasis,
  ice: () => false,
  course: { kind: "run", name: "협곡 랠리", gates: D.DESERT_GATES },
  sky: { bg: "#f6bd8b", fog: [80, 260], hemi: ["#ffe5c2", "#c97b4a", 1.05], sun: 2.1, sunColor: "#ffd2a1" },
};

export const MAPS: MapDef[] = [village, snow, desert];
let active: MapDef = village;

/** 공중 링 반짝임 시간 (맵마다 초기화) */
export const hoopFlash: number[] = [];

export function setMap(id: string) {
  active = MAPS.find((m) => m.id === id) ?? village;
  hoopFlash.length = 0;
  active.hoops.forEach(() => hoopFlash.push(-10));
}
setMap("village");

export const getMap = () => active;

/** 지형 + 점프대 + 단 높이 */
export function groundHeight(x: number, z: number): number {
  const m = active;
  let h = m.base(x, z);
  for (const p of m.platforms) {
    if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) h = Math.max(h, p.h);
  }
  for (const r of m.ramps) {
    const dx = x - r.x;
    const dz = z - r.z;
    const c = Math.cos(r.rot);
    const s = Math.sin(r.rot);
    const u = dx * c - dz * s;
    const v = dx * s + dz * c;
    if (Math.abs(u) <= r.length / 2 && Math.abs(v) <= r.width / 2) {
      h = Math.max(h, m.base(r.x, r.z) + (r.height * (u + r.length / 2)) / r.length);
    }
  }
  return h;
}

export function resolveCollisions(p: { x: number; z: number }, radius = 0.5) {
  for (const o of active.obstacles) {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + radius;
    if (d < min && d > 0.0001) {
      p.x = o.x + (dx / d) * min;
      p.z = o.z + (dz / d) * min;
    }
  }
  const S_ = active.size;
  p.x = Math.max(-S_, Math.min(S_, p.x));
  p.z = Math.max(-S_, Math.min(S_, p.z));
}

export function randomStarPos(): [number, number] {
  const m = active;
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() * 2 - 1) * (m.size - 10);
    const z = (Math.random() * 2 - 1) * (m.size - 10);
    if (m.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 1.5)) continue;
    if (m.water(x, z)) continue;
    return [x, z];
  }
  return [m.spawn.x + 5, m.spawn.z];
}
