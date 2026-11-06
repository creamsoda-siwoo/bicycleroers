# 🚲 자전거로어스 (bicycleroers)

귀여운 2등신 캐릭터가 다양한 자전거를 타고 3D 마을을 달리며 다른 사람들과 실시간으로 소통하는 놀이터입니다.

- **Next.js 16** (App Router) + **React Three Fiber / three.js** 3D
- **Supabase (yahomi 프로젝트)**: 채팅·랭킹 저장(Postgres), 실시간 위치·감정표현(Realtime Broadcast/Presence)

## 기능
- 자전거 9종: 로드바이크, 산악자전거, BMX, 크루저, 픽시, 미니벨로, 세발자전거, 외발자전거, 2인용 탠덤(곰돌이 동승)
  - 종류마다 속도·가속·회전·점프 성능이 다름 (산악자전거는 잔디에서도 감속 없음)
- 캐릭터 꾸미기: 옷 색깔 8종, 모자 6종 (헬멧/캡모자/토끼귀/비니/왕관/없음)
- 감정표현: 🙇 큰절(B) · 👋 인사(H) · 🙌 만세(C) — 다른 플레이어에게도 보임
- 실시간 멀티플레이: 접속자 위치, 이름표, 말풍선 채팅
- 3D 마을: 원형 트랙, 점프대, 분수 광장, 집·나무, ⭐ 별 모으기
- 최장 거리 랭킹 ("그만 타기" 시 10m 이상이면 저장)
- 모바일 터치 컨트롤

## 바로 플레이
https://bicycleroers.vercel.app (Vercel, 브랜치에 push하면 자동 배포)

## 실행
```bash
npm install
cp .env.example .env.local   # yahomi 프로젝트 URL / publishable key
npm run dev
```

## DB
`supabase/migrations/` 의 스키마가 yahomi 프로젝트에 적용되어 있습니다 (`bike_chat`, `bike_rides`, RLS: 누구나 읽기/쓰기만, 수정·삭제 불가).
