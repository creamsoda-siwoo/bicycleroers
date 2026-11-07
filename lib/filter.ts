// 부정 표현 차단: 띄어쓰기·숫자·특수문자를 끼워 넣어도 찾아서 ♡ 로 가림
// (서버에도 같은 목록이 있어 저장할 때 한 번 더 가려짐)
export const BANNED = [
  "씨발", "시발", "씨바", "시바", "씨빨", "씨팔", "시팔", "ㅅㅂ", "ㅆㅂ", "ㅆㅃ", "씹", "좆", "좇", "존나", "졸라", "ㅈㄴ",
  "병신", "븅신", "빙신", "ㅂㅅ", "개새끼", "개새기", "개색기", "개색히", "새끼", "색히", "ㅅㄲ", "개년", "개놈",
  "미친놈", "미친년", "미친새", "ㅁㅊ", "지랄", "ㅈㄹ", "닥쳐", "꺼져", "엿먹", "엠창", "느금", "니애미", "니미", "느그애미", "애미", "애비",
  "섹스", "야동", "자지", "보지", "빠구리", "걸레", "창녀", "등신", "또라이", "찐따", "한남", "한녀", "틀딱", "급식충", "맘충",
  "죽어라", "뒤져", "뒈져", "자살",
  "fuck", "fck", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "nigger", "nigga", "faggot", "retard", "bastard", "porn", "sex",
];

/** 금지어가 들어 있지만 괜찮은 말 */
export const ALLOWED = ["시바견", "시바이누", "새끼고양이", "새끼강아지", "새끼오리", "새끼곰", "새끼손가락", "애비뉴", "sextet", "dickens"];

const isLetter = (ch: string) => /[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]/.test(ch);

/** 금지어를 ♡ 로 가린 문자열 */
export function cleanText(text: string): string {
  if (!text) return text;
  const chars = Array.from(text);
  // 글자만 모은 문자열과 원래 위치
  const idx: number[] = [];
  let norm = "";
  chars.forEach((c, i) => {
    if (isLetter(c)) {
      idx.push(i);
      norm += c.toLowerCase();
    }
  });
  const mask = new Array(chars.length).fill(false);
  // 허용 단어 위치는 건너뜀
  const safe = new Array(norm.length).fill(false);
  for (const w of ALLOWED) {
    let f = 0;
    for (;;) {
      const at = norm.indexOf(w, f);
      if (at < 0) break;
      for (let k = at; k < at + w.length; k++) safe[k] = true;
      f = at + 1;
    }
  }
  for (const w of BANNED) {
    const lw = w.toLowerCase();
    let from = 0;
    for (;;) {
      const at = norm.indexOf(lw, from);
      if (at < 0) break;
      if (safe[at]) {
        from = at + 1;
        continue;
      }
      const a = idx[at];
      const b = idx[at + Array.from(lw).length - 1];
      for (let k = a; k <= b; k++) mask[k] = true;
      from = at + 1;
    }
  }
  let changed = false;
  const out = chars.map((c, i) => {
    if (mask[i] && isLetter(c)) {
      changed = true;
      return "♡";
    }
    if (mask[i]) return "";
    return c;
  });
  return changed ? out.join("") : text;
}

export function hasBanned(text: string) {
  return cleanText(text) !== text;
}
