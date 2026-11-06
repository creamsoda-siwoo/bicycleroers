import type { EmoteId, TrickId } from "@/lib/profile";

/** 라이더 애니메이션 상태 (매 프레임 갱신, React 상태 아님) */
export interface AnimState {
  speed: number;
  dist: number;
  lean: number;
  emote: EmoteId | null;
  emoteAt: number;
  trick: TrickId | null;
  trickAt: number;
  crashAt: number;
  /** 물에 빠져 있음 */
  wet: boolean;
  /** 크랭크 각도 (페달을 밟을 때만 돎) */
  crank: number;
  /** 일어서서 밟는 정도 0~1 */
  sprint: number;
  /** 착지 충격 0~1 */
  squash: number;
  /** 브레이크로 앞이 숙여지는 정도 0~1 */
  brake: number;
  /** 드리프트 중 미끄러지는 각도 (라디안) */
  slip: number;
}

export const newAnim = (): AnimState => ({
  speed: 0, dist: 0, lean: 0, emote: null, emoteAt: 0, trick: null, trickAt: 0, crashAt: -10, wet: false,
  crank: 0, sprint: 0, squash: 0, brake: 0, slip: 0,
});

export const now = () => performance.now() / 1000;

export const CRASH_DUR = 1.4;
