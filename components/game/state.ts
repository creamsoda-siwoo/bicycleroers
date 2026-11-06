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
