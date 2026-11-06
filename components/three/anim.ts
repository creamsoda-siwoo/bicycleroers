import type { EmoteId } from "@/lib/profile";

/** 라이더 애니메이션 상태 (매 프레임 갱신, React 상태 아님) */
export interface AnimState {
  speed: number;
  dist: number;
  lean: number;
  emote: EmoteId | null;
  emoteAt: number;
}

export const newAnim = (): AnimState => ({ speed: 0, dist: 0, lean: 0, emote: null, emoteAt: 0 });

export const now = () => performance.now() / 1000;
