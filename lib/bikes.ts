export type BikeId =
  | "road"
  | "mtb"
  | "bmx"
  | "cruiser"
  | "fixie"
  | "minivelo"
  | "tricycle"
  | "unicycle"
  | "tandem";

/** y, z (자전거 로컬 좌표, 앞 = +z) */
export type YZ = [number, number];

export interface BikeSpec {
  id: BikeId;
  name: string;
  emoji: string;
  desc: string;
  frame: string;
  accent: string;
  /** 바퀴 반지름 / 타이어 두께 */
  wheel: number;
  tire: number;
  /** 앞뒤 바퀴 간 거리 */
  base: number;
  seat: YZ;
  bar: YZ | null;
  bb: YZ;
  /** 크랭크 1회전에 바퀴가 도는 비율 */
  gear: number;
  /** 주행 성능 */
  maxSpeed: number;
  accel: number;
  turn: number;
  jump: number;
}

export const BIKES: BikeSpec[] = [
  {
    id: "road", name: "로드바이크", emoji: "🚴", desc: "가볍고 빠른 스피드 머신",
    frame: "#e63946", accent: "#f1faee", wheel: 0.36, tire: 0.025, base: 1.0,
    seat: [0.95, -0.25], bar: [0.93, 0.4], bb: [0.32, -0.05], gear: 2.6,
    maxSpeed: 16, accel: 7, turn: 1.8, jump: 5,
  },
  {
    id: "mtb", name: "산악자전거", emoji: "⛰️", desc: "두꺼운 타이어로 어디든 씽씽",
    frame: "#2a9d8f", accent: "#264653", wheel: 0.37, tire: 0.06, base: 1.05,
    seat: [0.92, -0.25], bar: [1.0, 0.38], bb: [0.36, -0.05], gear: 2.0,
    maxSpeed: 12, accel: 7, turn: 2.2, jump: 6.5,
  },
  {
    id: "bmx", name: "BMX", emoji: "🤸", desc: "점프와 묘기의 달인",
    frame: "#8338ec", accent: "#ffbe0b", wheel: 0.26, tire: 0.05, base: 0.85,
    seat: [0.62, -0.28], bar: [0.95, 0.3], bb: [0.28, -0.03], gear: 2.2,
    maxSpeed: 10, accel: 9, turn: 2.8, jump: 8,
  },
  {
    id: "cruiser", name: "크루저", emoji: "🌴", desc: "바구니 달린 느긋한 산책용",
    frame: "#ff8fab", accent: "#fff3b0", wheel: 0.36, tire: 0.065, base: 1.15,
    seat: [0.9, -0.35], bar: [1.05, 0.35], bb: [0.3, 0.0], gear: 1.8,
    maxSpeed: 9, accel: 4, turn: 1.6, jump: 4,
  },
  {
    id: "fixie", name: "픽시", emoji: "😎", desc: "알록달록 딥림 감성",
    frame: "#111111", accent: "#06d6a0", wheel: 0.36, tire: 0.03, base: 1.0,
    seat: [0.97, -0.25], bar: [0.92, 0.4], bb: [0.33, -0.05], gear: 2.4,
    maxSpeed: 14, accel: 8, turn: 2.0, jump: 5,
  },
  {
    id: "minivelo", name: "미니벨로", emoji: "🍡", desc: "작은 바퀴, 귀여운 회전",
    frame: "#ffd166", accent: "#118ab2", wheel: 0.22, tire: 0.04, base: 0.95,
    seat: [0.92, -0.25], bar: [1.0, 0.35], bb: [0.25, -0.02], gear: 3.2,
    maxSpeed: 10, accel: 7, turn: 2.6, jump: 5.5,
  },
  {
    id: "tricycle", name: "세발자전거", emoji: "🧸", desc: "절대 안 넘어지는 동심 모드",
    frame: "#f94144", accent: "#90be6d", wheel: 0.3, tire: 0.05, base: 0.8,
    seat: [0.55, -0.15], bar: [0.85, 0.3], bb: [0.3, 0.4], gear: 1,
    maxSpeed: 6, accel: 5, turn: 2.4, jump: 3,
  },
  {
    id: "unicycle", name: "외발자전거", emoji: "🎪", desc: "균형감각 만렙 서커스",
    frame: "#3a86ff", accent: "#ffbe0b", wheel: 0.36, tire: 0.04, base: 0,
    seat: [1.05, 0], bar: null, bb: [0.36, 0], gear: 1,
    maxSpeed: 7, accel: 4, turn: 3.0, jump: 6,
  },
  {
    id: "tandem", name: "2인용 탠덤", emoji: "🐻", desc: "곰돌이 친구와 함께 달려요",
    frame: "#43aa8b", accent: "#f9c74f", wheel: 0.36, tire: 0.035, base: 1.9,
    seat: [0.95, 0.2], bar: [0.95, 0.75], bb: [0.32, 0.35], gear: 2.4,
    maxSpeed: 15, accel: 5, turn: 1.2, jump: 4,
  },
];

export const BIKE_MAP: Record<BikeId, BikeSpec> = Object.fromEntries(
  BIKES.map((b) => [b.id, b]),
) as Record<BikeId, BikeSpec>;

export function getBike(id: string): BikeSpec {
  return BIKE_MAP[id as BikeId] ?? BIKE_MAP.road;
}
