// 조작 설정 (브라우저에 저장)
export interface ControlSettings {
  /** joystick: 조이스틱 하나로 방향+속도 / pad: 핸들+페달 버튼 */
  steerMode: "joystick" | "pad";
  autoPedal: boolean;
  tilt: boolean;
  haptics: boolean;
  /** 핸들 감도 0.7 / 1 / 1.35 */
  sensitivity: number;
}

const KEY = "bicycleroers-controls-v2";

export const controls: ControlSettings & { touch: boolean; armed: boolean } = {
  steerMode: "joystick",
  autoPedal: false,
  tilt: false,
  haptics: true,
  sensitivity: 1,
  touch: false,
  /** 처음으로 조작 버튼을 만진 뒤부터 자동 페달 동작 */
  armed: false,
};

export function loadControls(isTouch: boolean) {
  controls.touch = isTouch;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(controls, JSON.parse(raw));
  } catch {
    /* 무시 */
  }
  controls.touch = isTouch;
  if (!isTouch) controls.tilt = false;
}

export function saveControls() {
  try {
    const { steerMode, autoPedal, tilt, haptics, sensitivity } = controls;
    localStorage.setItem(KEY, JSON.stringify({ steerMode, autoPedal, tilt: false, haptics, sensitivity }));
  } catch {
    /* 무시 */
  }
}

/** 진동 (지원하는 기기만) */
export function buzz(pattern: number | number[]) {
  if (!controls.touch || !controls.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 무시 */
  }
}

// ── 기울기 조종 ──
let tiltZero = 0;
let tiltRaw = 0;
let tiltOn = false;

function readTilt(e: DeviceOrientationEvent) {
  const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
  // 세로: gamma(좌우), 가로: beta
  let v = 0;
  if (angle === 90) v = e.beta ?? 0;
  else if (angle === -90 || angle === 270) v = -(e.beta ?? 0);
  else v = e.gamma ?? 0;
  tiltRaw = v;
}

export function tiltSteer(): number {
  if (!tiltOn) return 0;
  const d = tiltRaw - tiltZero;
  const dead = Math.abs(d) < 3 ? 0 : d - Math.sign(d) * 3;
  return Math.max(-1, Math.min(1, -dead / 22));
}

export async function enableTilt(): Promise<boolean> {
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  try {
    if (DOE?.requestPermission) {
      const r = await DOE.requestPermission();
      if (r !== "granted") return false;
    }
  } catch {
    return false;
  }
  if (!tiltOn) window.addEventListener("deviceorientation", readTilt);
  tiltOn = true;
  // 잠깐 뒤 현재 자세를 0점으로
  await new Promise((r) => setTimeout(r, 250));
  tiltZero = tiltRaw;
  return true;
}

export function disableTilt() {
  window.removeEventListener("deviceorientation", readTilt);
  tiltOn = false;
}

export function recenterTilt() {
  tiltZero = tiltRaw;
}
