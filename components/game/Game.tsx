"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { getBike } from "@/lib/bikes";
import { EMOTES, loadProfile, type EmoteId, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { World } from "../three/World";
import { newAnim, now } from "../three/anim";
import { Player, RemoteRider, stats, view } from "./Scene";
import { bindKeyboard, input } from "./input";
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

  if (!profile) return <div className="loading">자전거 준비 중… 🚲</div>;
  return <GameInner profile={profile} />;
}

function GameInner({ profile }: { profile: Profile }) {
  const router = useRouter();
  const myId = useMemo(() => crypto.randomUUID(), []);
  const anim = useMemo(() => newAnim(), []);
  const net = useNet(profile, myId);
  const spec = getBike(profile.bike);

  const [hud, setHud] = useState({ speed: 0, dist: 0, stars: 0 });
  const [, setTick] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const chatList = useRef<HTMLDivElement>(null);
  const lastChat = useRef(0);
  const [viewMode, setViewMode] = useState(view.mode);

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
      }
    });
  }, [doEmote, cycleView]);

  useEffect(() => {
    const id = setInterval(() => {
      setHud({ speed: stats.speed, dist: stats.dist, stars: stats.stars });
      setTick((t) => t + 1);
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    chatList.current?.scrollTo({ top: chatList.current.scrollHeight });
  }, [net.messages, chatOpen]);

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
    const distance = Math.round(stats.dist);
    if (distance >= 10) {
      await supabase.from("bike_rides").insert({
        nickname: profile.nickname,
        bike: profile.bike,
        distance: Math.min(distance, 100000),
        stars: Math.min(stats.stars, 1000),
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
        dpr={[1, 2]}
        camera={{ fov: 60, near: 0.1, far: 600, position: [0, 5, -70] }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#bde0fe"]} />
        <fog attach="fog" args={["#bde0fe", 90, 260]} />
        <hemisphereLight args={["#ffffff", "#7fb069", 1.1]} />
        <ambientLight intensity={0.35} />
        <World />
        <Player profile={profile} anim={anim} myId={myId} bubble={bubbleOf(myId)} sendMove={net.sendMove} />
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
          </div>
        </div>
        <div className="panel online">
          <div className="online-title">
            <span className={net.connected ? "live on" : "live"} /> 접속 중 {net.players.length + 1}명
          </div>
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
              📷 {viewMode === "chase" ? "뒤에서" : viewMode === "front" ? "앞에서" : "위에서"}
            </button>
            <button className="btn small" onClick={exit} disabled={saving}>
              {saving ? "저장 중…" : "🏁 그만 타기"}
            </button>
          </div>
        </div>
      </div>

      {/* 감정표현 */}
      <div className="emotes">
        {EMOTES.map((e) => (
          <button key={e.id} className="btn emote" onClick={() => doEmote(e.id)}>
            {e.label} <kbd>{e.key}</kbd>
          </button>
        ))}
      </div>

      {/* 채팅 */}
      <div className={chatOpen ? "chat panel" : "chat panel closed"}>
        <button className="chat-toggle" onClick={() => setChatOpen((o) => !o)}>
          💬 채팅 {chatOpen ? "▾" : "▴"}
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

      {/* 모바일 컨트롤 */}
      <div className="touch">
        <div className="pad">
          <button className="tbtn" {...hold("l")}>◀</button>
          <div className="col">
            <button className="tbtn" {...hold("f")}>▲</button>
            <button className="tbtn" {...hold("b")}>▼</button>
          </div>
          <button className="tbtn" {...hold("r")}>▶</button>
        </div>
        <button className="tbtn jump" {...hold("jump")}>점프</button>
      </div>

      <div className="help">W/↑ 페달 · S/↓ 브레이크 · A D/← → 방향 · Space 점프 · B 절 · H 인사 · C 만세 · V 카메라 · Enter 채팅</div>
    </div>
  );
}
