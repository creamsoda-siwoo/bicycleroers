"use client";

import { useState } from "react";
import { ITEMS, SLOTS, type Slot } from "@/lib/shop";
import { buyItem, equipItem, exportCode, importCode, type PlayerData } from "@/lib/player";

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

export default function Garage({
  player,
  onChange,
  error,
}: {
  player: PlayerData | null;
  onChange: (p: PlayerData) => void;
  error?: string;
}) {
  const [slot, setSlot] = useState<Slot>("paint");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);

  if (!player) {
    return (
      <section className="card garage">
        <h2>🛠️ 차고</h2>
        <p className="muted">{error ? `기록을 불러오지 못했어요: ${error}` : "내 기록 불러오는 중…"}</p>
      </section>
    );
  }

  const act = async (id: string, fn: () => Promise<PlayerData>, ok: string) => {
    setBusy(id);
    setMsg("");
    try {
      onChange(await fn());
      setMsg(ok);
    } catch (e) {
      setMsg(`😢 ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const myCode = exportCode();

  return (
    <section className="card garage">
      <div className="garage-head">
        <h2>🛠️ 차고 — 별로 자전거 꾸미기</h2>
        <div className="wallet-big">⭐ {player.stars.toLocaleString()}</div>
      </div>
      <div className="records">
        <div><small>총 주행</small><b>{fmtDist(player.total_distance)}</b></div>
        <div><small>한 판 최고 거리</small><b>{fmtDist(player.best_distance)}</b></div>
        <div><small>한 판 최고 묘기</small><b>{player.best_trick.toLocaleString()}</b></div>
        <div><small>누적 묘기 점수</small><b>{player.total_trick.toLocaleString()}</b></div>
        <div><small>모은 별 합계</small><b>{player.stars_earned.toLocaleString()}</b></div>
        <div><small>탄 횟수</small><b>{player.rides}번</b></div>
      </div>

      <div className="chips tabs">
        {SLOTS.map((s) => (
          <button key={s.id} className={slot === s.id ? "chip on" : "chip"} onClick={() => setSlot(s.id)}>
            {s.icon} {s.name}
          </button>
        ))}
      </div>

      <div className="items">
        {ITEMS.filter((i) => i.slot === slot).map((it) => {
          const owned = player.owned.includes(it.id);
          const on = player.equipped[it.slot] === it.id;
          const poor = player.stars < it.price;
          return (
            <div key={it.id} className={on ? "item on" : owned ? "item owned" : "item"}>
              <div className="item-icon">{it.icon}</div>
              <div className="item-name">{it.name}</div>
              {on ? (
                <button className="btn small ghost" disabled={busy === it.id} onClick={() => act(it.id, () => equipItem(it.slot, null), `${it.name} 해제했어요`)}>
                  장착 중 ✓
                </button>
              ) : owned ? (
                <button className="btn small" disabled={busy === it.id} onClick={() => act(it.id, () => equipItem(it.slot, it.id), `${it.name} 장착!`)}>
                  장착
                </button>
              ) : (
                <button
                  className="btn small buy"
                  disabled={poor || busy === it.id}
                  onClick={() => act(it.id, () => buyItem(it.id), `🎉 ${it.name} 구매 완료!`)}
                >
                  ⭐ {it.price}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <div className="garage-msg">{msg}</div>}
      <p className="muted small-note">별은 마을에서 ⭐ 별을 줍거나 💫 공중 링을 통과하면 모여요. 기록은 자동 저장돼요.</p>

      <details className="transfer" open={showCode} onToggle={(e) => setShowCode((e.target as HTMLDetailsElement).open)}>
        <summary>📱 다른 기기에서 이어하기</summary>
        <p className="muted small-note">이 코드를 다른 기기에 붙여넣으면 별·아이템·기록을 그대로 가져가요. 남에게 알려주지 마세요!</p>
        {myCode && (
          <div className="row">
            <input readOnly value={myCode} onFocus={(e) => e.target.select()} />
            <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(myCode).then(() => setMsg("코드를 복사했어요"))}>
              복사
            </button>
          </div>
        )}
        <div className="row">
          <input placeholder="받은 코드 붙여넣기" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn small" onClick={() => act("import", () => importCode(code), "기록을 불러왔어요!")}>
            불러오기
          </button>
        </div>
      </details>
    </section>
  );
}
