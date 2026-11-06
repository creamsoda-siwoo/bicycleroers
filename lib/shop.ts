// 자전거 꾸미기 아이템 (가격은 서버 bike_items 테이블과 같아야 함)
export type Slot = "paint" | "rim" | "acc" | "trail" | "pet";
export type Equipped = Partial<Record<Slot, string>>;

export interface ShopItem {
  id: string;
  slot: Slot;
  name: string;
  icon: string;
  price: number;
  /** 색 (페인트·림) */
  color?: string;
  metal?: boolean;
  glow?: boolean;
  rainbow?: boolean;
}

export const SLOTS: { id: Slot; name: string; icon: string }[] = [
  { id: "paint", name: "프레임 도색", icon: "🎨" },
  { id: "rim", name: "바퀴 림", icon: "⭕" },
  { id: "acc", name: "액세서리", icon: "🎈" },
  { id: "trail", name: "꼬리 효과", icon: "✨" },
  { id: "pet", name: "동승 펫", icon: "🐾" },
];

export const ITEMS: ShopItem[] = [
  { id: "paint_mint", slot: "paint", name: "민트", icon: "🟩", price: 10, color: "#64dfdf" },
  { id: "paint_pink", slot: "paint", name: "핑크", icon: "🩷", price: 10, color: "#ff8fab" },
  { id: "paint_navy", slot: "paint", name: "네이비", icon: "🟦", price: 10, color: "#22577a" },
  { id: "paint_black", slot: "paint", name: "매트 블랙", icon: "⬛", price: 15, color: "#1b1b1b" },
  { id: "paint_gold", slot: "paint", name: "황금", icon: "🥇", price: 60, color: "#ffc300", metal: true },
  { id: "paint_chrome", slot: "paint", name: "크롬", icon: "🪩", price: 70, color: "#e0e0e0", metal: true },
  { id: "paint_rainbow", slot: "paint", name: "무지개", icon: "🌈", price: 120, rainbow: true },

  { id: "rim_neon", slot: "rim", name: "네온 블루", icon: "💠", price: 30, color: "#4cc9f0", glow: true },
  { id: "rim_fire", slot: "rim", name: "불꽃", icon: "🔥", price: 40, color: "#ff5400", glow: true },
  { id: "rim_gold", slot: "rim", name: "골드 림", icon: "🟡", price: 50, color: "#ffc300", metal: true },
  { id: "rim_rainbow", slot: "rim", name: "무지개 림", icon: "🌀", price: 90, rainbow: true, glow: true },

  { id: "acc_flag", slot: "acc", name: "깃발", icon: "🚩", price: 20 },
  { id: "acc_light", slot: "acc", name: "헤드라이트", icon: "🔦", price: 25 },
  { id: "acc_balloon", slot: "acc", name: "하트 풍선", icon: "🎈", price: 30 },
  { id: "acc_wings", slot: "acc", name: "천사 날개", icon: "🪽", price: 150 },

  { id: "trail_spark", slot: "trail", name: "반짝이", icon: "✨", price: 60 },
  { id: "trail_heart", slot: "trail", name: "하트", icon: "💖", price: 70 },
  { id: "trail_rainbow", slot: "trail", name: "무지개", icon: "🌈", price: 100 },

  { id: "pet_duck", slot: "pet", name: "오리", icon: "🐥", price: 25 },
  { id: "pet_cat", slot: "pet", name: "고양이", icon: "🐱", price: 40 },
  { id: "pet_dog", slot: "pet", name: "강아지", icon: "🐶", price: 45 },
];

export const ITEM_MAP: Record<string, ShopItem> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function item(equip: Equipped | undefined, slot: Slot): ShopItem | undefined {
  const id = equip?.[slot];
  return id ? ITEM_MAP[id] : undefined;
}
