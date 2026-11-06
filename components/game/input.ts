// 키보드 + 터치 입력 공유 상태
export const input = { f: false, b: false, l: false, r: false, jump: false };

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
