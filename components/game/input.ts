import type { TrickId } from "@/lib/profile";

// 키보드 + 터치 입력 공유 상태
export const input = { f: false, b: false, l: false, r: false, jump: false };

/** 아날로그 입력 (조이스틱·게임패드). active 일 때 키보드 방향 대신 사용 */
export const axis = {
  steer: 0, // -1(오른쪽) ~ 1(왼쪽)
  steerActive: false,
  throttle: 0, // 0~1 (게임패드 트리거)
  brake: 0,
  jump: false,
  padActive: false,
};
/** 다음 프레임에 시도할 묘기 */
export const trickQueue: { id: TrickId | null; at: number } = { id: null, at: 0 };

export function queueTrick(id: TrickId) {
  trickQueue.id = id;
  trickQueue.at = performance.now() / 1000;
}

const MAP: Record<string, keyof typeof input> = {
  KeyW: "f", ArrowUp: "f",
  KeyS: "b", ArrowDown: "b",
  KeyA: "l", ArrowLeft: "l",
  KeyD: "r", ArrowRight: "r",
  Space: "jump",
};

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}

export function bindKeyboard(onKey: (code: string) => void) {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    const k = MAP[e.code];
    if (k) {
      input[k] = true;
      e.preventDefault();
    }
    onKey(e.code);
  };
  const up = (e: KeyboardEvent) => {
    const k = MAP[e.code];
    if (k) input[k] = false;
  };
  const blur = () => {
    (Object.keys(input) as (keyof typeof input)[]).forEach((k) => (input[k] = false));
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
  };
}

// ── 게임패드 ──
const prevPad: boolean[] = [];
const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);

/** 매 프레임 호출. 눌린 순간의 버튼 번호 목록을 돌려줌 */
export function pollGamepad(): number[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  const pads = navigator.getGamepads();
  const pad = Array.from(pads).find((p) => p && p.connected);
  if (!pad) {
    if (axis.padActive) {
      axis.padActive = false;
      axis.steerActive = false;
      axis.throttle = 0;
      axis.brake = 0;
      axis.jump = false;
    }
    return [];
  }
  axis.padActive = true;
  const sx = dz(pad.axes[0] ?? 0);
  const btn = (i: number) => pad.buttons[i]?.value ?? 0;
  const pressed = (i: number) => !!pad.buttons[i]?.pressed;
  // 왼쪽 스틱 또는 십자키 좌우
  const dpad = (pressed(14) ? 1 : 0) - (pressed(15) ? 1 : 0);
  axis.steer = dpad !== 0 ? dpad : -sx;
  axis.steerActive = Math.abs(axis.steer) > 0.01;
  axis.throttle = Math.max(btn(7), pressed(12) ? 1 : 0);
  axis.brake = Math.max(btn(6), pressed(13) ? 1 : 0);
  axis.jump = pressed(0);
  const fresh: number[] = [];
  for (let i = 0; i < pad.buttons.length; i++) {
    const p = pressed(i);
    if (p && !prevPad[i]) fresh.push(i);
    prevPad[i] = p;
  }
  return fresh;
}
