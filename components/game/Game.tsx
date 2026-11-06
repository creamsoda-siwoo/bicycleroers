"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { getBike } from "@/lib/bikes";
import { EMOTES, TRICKS, loadProfile, type EmoteId, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { ensurePlayer, saveProgress, saveProgressOnExit, type ProgressDelta } from "@/lib/player";
import { World } from "../three/World";
import { newAnim, now } from "../three/anim";
import { Player, RemoteRider, popups, stats, view } from "./Scene";
import { bindKeyboard, input, queueTrick } from "./input";
import { useNet } from "./net";

const BUBBLE_MS = 6000;

export default function Game() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const p = loadProfile();
    if (!p) router.replace("/");
    else setProfile(p);
  }, [router]);

  const [wallet, setWallet] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!profile || ready) return;
    // 서버에 저장된 꾸미기·별 불러오기 (실패해도 게임은 진행)
    ensurePlayer(profile.nickname)
      .then((pl) => {
        setProfile((p) => (p ? { ...p, equip: pl.equipped } : p));
        setWallet(pl.stars);
      })
      .catch(() => setWallet(null))
      .finally(() => setReady(true));
  }, [profile, ready]);

  if (!profile || !ready) return <div className="loading">자전거 준비 중… 🚲</div>;
  return <GameInner profile={profile} wallet={wallet} />;
}

function GameInner({ profile, wallet }: { profile: Profile; wallet: number | null }) {
  const router = useRouter();
  const myId = useMemo(() => crypto.randomUUID(), []);
  const anim = useMemo(() => newAnim(), []);
  const net = useNet(profile, myId);
  const spec = getBike(profile.bike);

  const [hud, setHud] = useState({ speed: 0, dist: 0, stars: 0, trick: 0, air: false, boost: false });
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const toastId = useRef(0);
  const [, setTick] = useState(0);
  const isTouch = useMemo(
    () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760),
    [],
  );
  const [chatOpen, setChatOpen] = useState(!isTouch);
  const [unread, setUnread] = useState(0);
  const seenCount = useRef(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const chatList = useRef<HTMLDivElement>(null);
  const lastChat = useRef(0);
  const [viewMode, setViewMode] = useState(view.mode);
  const [walletBase, setWalletBase] = useState(wallet);
  // 마지막으로 서버에 저장한 시점의 누적값
  const saved = useRef({ dist: 0, stars: 0, trick: 0 });
  const saving_ = useRef(false);

  const delta = useCallback(
    (finished: boolean): ProgressDelta => ({
      nickname: profile.nickname,
      distance: stats.dist - saved.current.dist,
      stars: stats.stars - saved.current.stars,
      trick: stats.trickScore - saved.current.trick,
      bestTrick: stats.trickScore,
      bestDistance: stats.dist,
      finished,
    }),
    [profile.nickname],
  );

  const autosave = useCallback(
    async (finished: boolean) => {
      if (saving_.current) return;
      saving_.current = true;
      const snap = { dist: stats.dist, stars: stats.stars, trick: stats.trickScore };
      const res = await saveProgress(delta(finished));
      if (res) {
        saved.current = snap;
        setWalletBase(res.stars);
      }
      saving_.current = false;
    },
    [delta],
  );

  useEffect(() => {
    const id = setInterval(() => void autosave(false), 20000);
    const onHide = () => {
      if (stats.dist - saved.current.dist > 1 || stats.stars > saved.current.stars || stats.trickScore > saved.current.trick) {
        saveProgressOnExit(delta(true));
        saved.current = { dist: stats.dist, stars: stats.stars, trick: stats.trickScore };
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", onHide);
    };
  }, [autosave, delta]);

  const { sendEmote } = net;
  const doEmote = useCallback(
    (e: EmoteId) => {
      if (anim.emote && now() - anim.emoteAt < 0.5) return;
      anim.emote = e;
      anim.emoteAt = now();
      sendEmote(e);
    },
    [anim, sendEmote],
  );

  const cycleView = useCallback(() => {
    const order = ["chase", "front", "top"] as const;
    view.mode = order[(order.indexOf(view.mode) + 1) % order.length];
    setViewMode(view.mode);
  }, []);

  useEffect(() => {
    stats.dist = 0;
    stats.stars = 0;
    stats.trickScore = 0;
    popups.length = 0;
  }, []);

  useEffect(() => {
    return bindKeyboard((code) => {
      if (code === "KeyB") doEmote("bow");
      else if (code === "KeyH") doEmote("wave");
      else if (code === "KeyC") doEmote("cheer");
      else if (code === "KeyV") cycleView();
      else if (code === "Enter") {
        setChatOpen(true);
        setTimeout(() => chatInput.current?.focus(), 0);
      } else {
        const tr = TRICKS.find((x) => `Key${x.key}` === code);
        if (tr) queueTrick(tr.id);
      }
    });
  }, [doEmote, cycleView]);

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (popups.length) {
        const fresh = popups.splice(0).map((p) => ({ id: ++toastId.current, ...p }));
        setToasts((old) => [...old, ...fresh].slice(-3));
        for (const f of fresh) {
          setTimeout(() => setToasts((old) => old.filter((x) => x.id !== f.id)), f.kind === "trick" ? 2200 : 1500);
        }
      }
      if (++n % 2 === 0) {
        setHud({
          speed: stats.speed, dist: stats.dist, stars: stats.stars, trick: stats.trickScore,
          air: stats.airborne, boost: stats.boosting,
        });
        setTick((t) => t + 1);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    chatList.current?.scrollTo({ top: chatList.current.scrollHeight });
    if (chatOpen) {
      seenCount.current = net.messages.length;
      setUnread(0);
    } else {
      setUnread(Math.max(0, net.messages.length - seenCount.current));
    }
  }, [net.messages, chatOpen]);

  // 모바일: 길게 누르기 메뉴/더블탭 확대 방지
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", stop);
    document.addEventListener("gesturestart", stop);
    return () => {
      window.removeEventListener("contextmenu", stop);
      document.removeEventListener("gesturestart", stop);
    };
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    if (Date.now() - lastChat.current < 1000) return;
    lastChat.current = Date.now();
    setText("");
    await net.sendChat(t);
  };

  const exit = async () => {
    if (saving) return;
    setSaving(true);
    await autosave(true);
    const distance = Math.round(stats.dist);
    if (distance >= 10 || stats.trickScore > 0) {
      await supabase.from("bike_rides").insert({
        nickname: profile.nickname,
        bike: profile.bike,
        distance: Math.min(distance, 100000),
        stars: Math.min(stats.stars, 1000),
        trick_score: Math.min(Math.round(stats.trickScore), 10000000),
      });
    }
    router.push("/");
  };

  const bubbleOf = (id: string) => {
    const b = net.bubbles[id];
    return b && Date.now() - b.at < BUBBLE_MS ? b.text : null;
  };

  const hold = (k: keyof typeof input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      input[k] = true;
    },
    onPointerUp: () => (input[k] = false),
    onPointerLeave: () => (input[k] = false),
    onPointerCancel: () => (input[k] = false),
  });

  return (
    <div className="game">
      <Canvas
        shadows
        dpr={isTouch ? [1, 1.5] : [1, 2]}
        camera={{ fov: 60, near: 0.1, far: 600, position: [0, 5, -70] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#bde0fe"]} />
        <fog attach="fog" args={["#bde0fe", 90, 260]} />
        <hemisphereLight args={["#ffffff", "#7fb069", 1.1]} />
        <ambientLight intensity={0.35} />
        <World />
        <Player profile={profile} anim={anim} myId={myId} lowPower={isTouch} bubble={bubbleOf(myId)} sendMove={net.sendMove} sendTrick={net.sendTrick} />
        {net.players.map((p) => (
          <RemoteRider key={p.id} player={p} remote={net.remotes.current.get(p.id)} bubble={bubbleOf(p.id)} />
        ))}
      </Canvas>

      {/* 상단 HUD */}
      <div className="hud-top">
        <div className="panel stat">
          <div className="me-line">
            <span className="dot" style={{ background: profile.color }} />
            <b>{profile.nickname}</b>
            <span className="muted">· {spec.emoji} {spec.name}</span>
          </div>
          <div className="stat-grid">
            <div><span className="big">{Math.round(hud.speed * 3.6)}</span><small>km/h</small></div>
            <div><span className="big">{hud.dist >= 1000 ? (hud.dist / 1000).toFixed(2) : Math.round(hud.dist)}</span><small>{hud.dist >= 1000 ? "km" : "m"}</small></div>
            <div><span className="big">⭐ {hud.stars}</span></div>
            <div><span className="big">🤸 {hud.trick}</span></div>
          </div>
        </div>
        <div className="panel online">
          <div className="online-title">
            <span className={net.connected ? "live on" : "live"} /> 접속 중 {net.players.length + 1}명
          </div>
          {walletBase !== null && (
            <div className="wallet">보유 ⭐ <b>{walletBase + hud.stars - saved.current.stars}</b></div>
          )}
          <ul>
            <li><b>{profile.nickname}</b> (나)</li>
            {net.players.slice(0, 8).map((p) => (
              <li key={p.id}>
                <span className="dot" style={{ background: p.color }} />
                {getBike(p.bike).emoji} {p.nickname}
              </li>
            ))}
            {net.players.length > 8 && <li className="muted">외 {net.players.length - 8}명</li>}
          </ul>
          <div className="row">
            <button className="btn small ghost" onClick={cycleView}>
              📷<span className="lbl"> {viewMode === "chase" ? "뒤에서" : viewMode === "front" ? "앞에서" : "위에서"}</span>
            </button>
            <button className="btn small" onClick={exit} disabled={saving}>
              {saving ? "저장 중…" : <>🏁<span className="lbl"> 그만 타기</span></>}
            </button>
          </div>
        </div>
      </div>

      {/* 묘기 알림 */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
      {hud.boost && <div className="boost-fx" />}

      {/* 묘기 버튼 */}
      <div className={hud.air ? "tricks air" : "tricks"}>
        {TRICKS.map((tr) => (
          <button
            key={tr.id}
            className="btn trick"
            aria-label={tr.name}
            onPointerDown={(e) => {
              e.preventDefault();
              queueTrick(tr.id);
            }}
          >
            <span className="e-ico">{tr.icon}</span>
            <span className="e-txt">{tr.name}</span> <kbd>{tr.key}</kbd>
          </button>
        ))}
      </div>

      {/* 감정표현 */}
      <div className="emotes">
        {EMOTES.map((e) => (
          <button key={e.id} className="btn emote" onClick={() => doEmote(e.id)} aria-label={e.label}>
            <span className="e-ico">{e.label.split(" ")[0]}</span>
            <span className="e-txt">{e.label.split(" ")[1]}</span> <kbd>{e.key}</kbd>
          </button>
        ))}
      </div>

      {/* 채팅 */}
      <div className={chatOpen ? "chat panel" : "chat panel closed"}>
        <button className="chat-toggle" onClick={() => setChatOpen((o) => !o)}>
          💬 채팅 {chatOpen ? "▾" : "▴"}
          {!chatOpen && unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
        </button>
        {chatOpen && (
          <>
            <div className="chat-list" ref={chatList}>
              {net.messages.length === 0 && <div className="muted">첫 인사를 남겨보세요! 👋</div>}
              {net.messages.map((m) => (
                <div key={m.id} className="chat-msg">
                  <span className="dot" style={{ background: m.color }} />
                  <b>{getBike(m.bike).emoji} {m.nickname}</b> <span>{m.message}</span>
                </div>
              ))}
            </div>
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={chatInput}
                value={text}
                maxLength={200}
                placeholder="메시지 입력 (Enter)"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") (e.target as HTMLInputElement).blur();
                }}
              />
              <button className="btn small" type="submit">보내기</button>
            </form>
          </>
        )}
      </div>

      {/* 모바일 컨트롤: 왼손 방향, 오른손 페달/브레이크/점프 */}
      <div className="touch touch-left">
        <button className="tbtn" aria-label="왼쪽" {...hold("l")}>◀</button>
        <button className="tbtn" aria-label="오른쪽" {...hold("r")}>▶</button>
      </div>
      <div className="touch touch-right">
        <button className="tbtn small" aria-label="브레이크" {...hold("b")}>▼</button>
        <div className="col">
          <button className="tbtn jump" aria-label="점프" {...hold("jump")}>점프</button>
          <button className="tbtn pedal" aria-label="페달" {...hold("f")}>▲ 페달</button>
        </div>
      </div>

      <div className="help">W/↑ 페달 · S/↓ 브레이크 · A D/← → 방향 · Space 점프 · 공중에서 Q 백플립 · F 프론트플립 · E 스핀 · G 슈퍼맨 · R 노핸드 · B 절 · H 인사 · C 만세 · V 카메라 · Enter 채팅</div>
    </div>
  );
}
