"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BIKES, getBike } from "@/lib/bikes";
import {
  COLORS, DEFAULT_PROFILE, EMOTES, HATS, loadProfile, saveProfile, type Profile,
} from "@/lib/profile";
import { supabase, type RideRecord } from "@/lib/supabase";
import { newAnim, now } from "./three/anim";

const Preview = dynamic(() => import("./Preview"), {
  ssr: false,
  loading: () => <div className="preview-loading">3D 불러오는 중…</div>,
});

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="bar">
      <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </span>
  );
}

export default function Lobby() {
  const router = useRouter();
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [board, setBoard] = useState<RideRecord[] | null>(null);
  const [tab, setTab] = useState<"distance" | "trick_score">("distance");
  const [error, setError] = useState("");
  const anim = useMemo(() => newAnim(), []);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) setP(saved);
  }, []);

  useEffect(() => {
    setBoard(null);
    let q = supabase.from("bike_rides").select("*").order(tab, { ascending: false }).limit(10);
    if (tab === "trick_score") q = q.gt("trick_score", 0);
    q.then(({ data, error }) => {
      if (error) setBoard([]);
      else setBoard((data as RideRecord[]) ?? []);
    });
  }, [tab]);

  const set = (patch: Partial<Profile>) => setP((old) => ({ ...old, ...patch }));
  const bike = getBike(p.bike);

  const start = () => {
    const nickname = p.nickname.trim();
    if (!nickname) {
      setError("닉네임을 입력해 주세요!");
      return;
    }
    if (nickname.length > 16) {
      setError("닉네임은 16자까지 가능해요.");
      return;
    }
    saveProfile({ ...p, nickname });
    router.push("/ride");
  };

  return (
    <main className="lobby">
      <header className="lobby-head">
        <h1>🚲 자전거로어스</h1>
        <p>귀여운 캐릭터와 자전거를 골라 친구들과 함께 3D 마을을 달려요. 만나면 꾸벅 절도 해보세요! 🙇</p>
      </header>

      <section className="lobby-grid">
        <div className="card preview-card">
          <div className="preview">
            <Preview profile={p} anim={anim} />
          </div>
          <div className="row center">
            {EMOTES.map((e) => (
              <button
                key={e.id}
                className="btn small ghost"
                onClick={() => {
                  anim.emote = e.id;
                  anim.emoteAt = now();
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <label className="field">
            <span>닉네임</span>
            <input
              value={p.nickname}
              maxLength={16}
              placeholder="예: 씽씽이"
              onChange={(e) => {
                setError("");
                set({ nickname: e.target.value });
              }}
              onKeyDown={(e) => e.key === "Enter" && start()}
            />
          </label>

          <div className="field">
            <span>옷 색깔</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={c}
                  className={p.color === c ? "swatch on" : "swatch"}
                  style={{ background: c }}
                  onClick={() => set({ color: c })}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <span>모자</span>
            <div className="chips">
              {HATS.map((h) => (
                <button key={h.id} className={p.hat === h.id ? "chip on" : "chip"} onClick={() => set({ hat: h.id })}>
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>자전거 · <b>{bike.name}</b> — {bike.desc}</span>
            <div className="bikes">
              {BIKES.map((b) => (
                <button key={b.id} className={p.bike === b.id ? "bike on" : "bike"} onClick={() => set({ bike: b.id })}>
                  <span className="emoji">{b.emoji}</span>
                  <span>{b.name}</span>
                </button>
              ))}
            </div>
            <div className="stats">
              <div>속도 <Bar value={bike.maxSpeed} max={16} /></div>
              <div>가속 <Bar value={bike.accel} max={9} /></div>
              <div>회전 <Bar value={bike.turn} max={3} /></div>
              <div>점프 <Bar value={bike.jump} max={8} /></div>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="btn go" onClick={start}>출발! 🚴</button>
        </div>

        <div className="card">
          <h2>🏆 랭킹</h2>
          <div className="chips tabs">
            <button className={tab === "distance" ? "chip on" : "chip"} onClick={() => setTab("distance")}>🚴 최장 거리</button>
            <button className={tab === "trick_score" ? "chip on" : "chip"} onClick={() => setTab("trick_score")}>🤸 묘기 점수</button>
          </div>
          {board === null ? (
            <p className="muted">불러오는 중…</p>
          ) : board.length === 0 ? (
            <p className="muted">아직 기록이 없어요. 첫 번째 주인공이 되어보세요!</p>
          ) : (
            <ol className="board">
              {board.map((r, i) => (
                <li key={r.id}>
                  <span className="rank">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
                  <span className="name">{getBike(r.bike).emoji} {r.nickname}</span>
                  {tab === "distance" ? (
                    <>
                      <span className="dist">{r.distance >= 1000 ? `${(r.distance / 1000).toFixed(2)}km` : `${r.distance}m`}</span>
                      <span className="muted">⭐{r.stars}</span>
                    </>
                  ) : (
                    <>
                      <span className="dist">{(r.trick_score ?? 0).toLocaleString()}점</span>
                      <span className="muted">⭐{r.stars}</span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          <h2>🎮 조작법</h2>
          <ul className="howto">
            <li><kbd>W</kbd>/<kbd>↑</kbd> 페달 · <kbd>S</kbd>/<kbd>↓</kbd> 브레이크</li>
            <li><kbd>A</kbd><kbd>D</kbd>/<kbd>←</kbd><kbd>→</kbd> 방향 · <kbd>Space</kbd> 점프</li>
            <li><kbd>B</kbd> 절하기 · <kbd>H</kbd> 인사 · <kbd>C</kbd> 만세</li>
            <li>공중에서 묘기: <kbd>Q</kbd> 백플립 · <kbd>F</kbd> 프론트플립 · <kbd>E</kbd> 360 · <kbd>G</kbd> 슈퍼맨 · <kbd>R</kbd> 노핸드</li>
            <li>묘기를 이어 쓰면 콤보 배율! 다 못 돌고 착지하면 꽈당 💥</li>
            <li><kbd>V</kbd> 카메라 전환 · <kbd>Enter</kbd> 채팅</li>
            <li>🛹 스케이트파크 · 🌈 무지개 다리 · 🎡 관람차 · 🚀 부스터 · 💫 공중 링을 찾아보세요!</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
