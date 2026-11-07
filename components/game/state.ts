/** 타임어택 상태 (HUD 표시용) */
export const race = { running: false, start: 0, next: 0, best: 0, last: 0, total: 0 };
/** 기록 저장 요청 (Game 에서 처리) */
export const raceResults: number[] = [];

export function resetRace() {
  race.running = false;
  race.start = 0;
  race.next = 0;
  race.best = 0;
  race.last = 0;
  race.total = 0;
  raceResults.length = 0;
}

/** 다 같이 레이스 */
export interface RaceEntry {
  id: string;
  nickname: string;
  ms?: number;
}

export const group = {
  /** idle: 없음, invited: 초대 받음, waiting: 참가 후 출발 대기, racing: 경주 중, done: 결과 */
  phase: "idle" as "idle" | "invited" | "waiting" | "racing" | "done",
  hostId: "",
  hostName: "",
  /** 출발 시각 (performance.now 기준 초) */
  goAt: 0,
  joined: false,
  entries: [] as RaceEntry[],
  /** 출발선 자리 번호 (Player 가 순간이동에 사용) */
  slot: 0,
  teleported: false,
  /** 내가 결승 통과한 기록 (Game 이 방송) */
  myFinish: null as number | null,
};

export function resetGroup() {
  group.phase = "idle";
  group.hostId = "";
  group.hostName = "";
  group.goAt = 0;
  group.joined = false;
  group.entries = [];
  group.slot = 0;
  group.teleported = false;
  group.myFinish = null;
}

/** 고스트(최고 기록 주행) — 맵별로 브라우저에 저장 */
export interface GhostFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  h: number;
}
export const ghost = {
  recording: [] as GhostFrame[],
  best: null as { ms: number; frames: GhostFrame[]; bike: string; color: string; hat: string } | null,
};

const GKEY = (map: string) => `bicycleroers-ghost-${map}`;

export function loadGhost(map: string) {
  try {
    const raw = localStorage.getItem(GKEY(map));
    ghost.best = raw ? JSON.parse(raw) : null;
  } catch {
    ghost.best = null;
  }
}

export function saveGhost(map: string, data: NonNullable<typeof ghost.best>) {
  ghost.best = data;
  try {
    localStorage.setItem(GKEY(map), JSON.stringify(data));
  } catch {
    /* 저장 공간 부족 등 무시 */
  }
}
