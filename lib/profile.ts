import type { BikeId } from "./bikes";
import type { Equipped } from "./shop";

export type HatId = "helmet" | "cap" | "bunny" | "beanie" | "crown" | "none";
export type EmoteId = "bow" | "wave" | "cheer";

export interface Profile {
  nickname: string;
  color: string;
  hat: HatId;
  bike: BikeId;
  /** 장착한 꾸미기 아이템 */
  equip?: Equipped;
  /** 선택한 맵 */
  map?: "village" | "snow" | "desert";
  /** 자전거 종류별로 지은 이름 */
  bikeNames?: Partial<Record<BikeId, string>>;
  /** 지금 타는 자전거 이름 (게임 중 표시용) */
  bikeName?: string;
  /** 서버 플레이어 id (별 선물용, 공개해도 됨) */
  pid?: string;
}

export const COLORS = [
  "#ffb703", "#fb8500", "#e63946", "#ff8fab",
  "#8338ec", "#3a86ff", "#06d6a0", "#8d6e63",
];

export const HATS: { id: HatId; name: string }[] = [
  { id: "helmet", name: "헬멧" },
  { id: "cap", name: "캡모자" },
  { id: "bunny", name: "토끼귀" },
  { id: "beanie", name: "비니" },
  { id: "crown", name: "왕관" },
  { id: "none", name: "없음" },
];

export const EMOTES: { id: EmoteId; label: string; key: string; dur: number }[] = [
  { id: "bow", label: "🙇 절하기", key: "B", dur: 3.2 },
  { id: "wave", label: "👋 인사", key: "H", dur: 2.2 },
  { id: "cheer", label: "🙌 만세", key: "C", dur: 2.2 },
];

export const EMOTE_DUR: Record<EmoteId, number> = Object.fromEntries(
  EMOTES.map((e) => [e.id, e.dur]),
) as Record<EmoteId, number>;

const KEY = "bicycleroers-profile";

export const DEFAULT_PROFILE: Profile = {
  nickname: "",
  color: COLORS[0],
  hat: "helmet",
  bike: "road",
};

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    if (!p.nickname) return null;
    return { ...DEFAULT_PROFILE, ...p };
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 저장 불가 환경 무시 */
  }
}

export type TrickId = "backflip" | "frontflip" | "spin" | "nohand" | "superman";

export const TRICKS: { id: TrickId; name: string; icon: string; key: string; dur: number; pts: number }[] = [
  { id: "backflip", name: "백플립", icon: "🔄", key: "Q", dur: 0.85, pts: 500 },
  { id: "frontflip", name: "프론트플립", icon: "🔃", key: "F", dur: 0.95, pts: 600 },
  { id: "spin", name: "360 스핀", icon: "🌀", key: "E", dur: 0.7, pts: 300 },
  { id: "superman", name: "슈퍼맨", icon: "🦸", key: "G", dur: 0.8, pts: 400 },
  { id: "nohand", name: "노핸드", icon: "🙌", key: "R", dur: 0.4, pts: 200 },
];

export const TRICK_MAP = Object.fromEntries(TRICKS.map((t) => [t.id, t])) as Record<TrickId, (typeof TRICKS)[number]>;

export function cleanBikeName(s: string) {
  return s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
}

/** 이름표에 쓸 표시 이름 */
export function displayName(p: Pick<Profile, "nickname" | "bikeName">, emoji: string) {
  return p.bikeName ? `${emoji} ${p.nickname} · 「${p.bikeName}」` : `${emoji} ${p.nickname}`;
}
