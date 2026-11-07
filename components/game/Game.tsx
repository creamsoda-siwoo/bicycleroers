"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { getBike } from "@/lib/bikes";
import { MAP_INFO } from "@/lib/mapInfo";
import { EMOTES, loadProfile, saveProfile, type EmoteId, type Profile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { ensurePlayer, giftStars, saveProgress, saveProgressOnExit, type ProgressDelta } from "@/lib/player";
import { World } from "../three/World";
import { newAnim, now } from "../three/anim";
import { GhostRider, Player, RemoteRider, fmtTime, popups, stats, view } from "./Scene";
import { ghost, group, loadGhost, race, raceResults, resetGroup, resetRace } from "./state";
import { getMap, setMap } from "@/lib/maps";
import { isMuted, setMuted, sfx, unlockAudio } from "@/lib/sound";
import { controls, disableTilt, enableTilt, loadControls, recenterTilt, saveControls } from "@/lib/settings";
import type { Remote } from "./net";
import DMPanel, { useDMNotify } from "./DMPanel";
import { dmThreads } from "@/lib/dm";
import { cleanText } from "@/lib/filter";
import { axis, bindKeyboard, input, queueTrick } from "./input";
import { useNet } from "./net";

const BUBBLE_MS = 6000;

/** 🕹️ 휴대폰 조이스틱: 왼쪽 아래 아무 데나 대고 밀기. 미는 쪽으로 가고, 많이 밀수록 빠름, 아래로 당기면 브레이크 */
function Joystick() {
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const R = 58;
  const move = (cx: number, cy: number) => {
    let dx = cx - origin.current.x;
    let dy = cy - origin.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      // 손가락이 많이 나가면 기준점이 따라옴
      origin.current.x += (dx / d) * (d - R);
      origin.current.y += (dy / d) * (d - R);
      if (base.current) base.current.style.transform = `translate(${origin.current.x - originBox.current.x - 70}px, ${origin.current.y - originBox.current.y - 70}px)`;
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / R;
    const ny = dy / R; // 아래가 +
    const mag = Math.min(1, Math.hypot(nx, ny));
    const dead = mag < 0.12;
    axis.steer = dead ? 0 : -Math.sign(nx) * Math.pow(Math.abs(nx), 1.15);
    axis.steerActive = !dead;
    if (ny > 0.5) {
      // 아래로 당김 = 브레이크
      axis.joyThrottle = 0;
      axis.joyBrake = Math.min(1, (ny - 0.35) / 0.55);
    } else {
      axis.joyBrake = 0;
      axis.joyThrottle = dead ? 0 : Math.min(1, 0.35 + mag * 0.75);
    }
  };
  const originBox = useRef({ x: 0, y: 0 });
  const release = () => {
    pid.current = null;
    setActive(false);
    if (knob.current) knob.current.style.transform = "translate(0px, 0px)";
    axis.steer = 0;
    axis.steerActive = false;
    axis.joyThrottle = 0;
    axis.joyBrake = 0;
  };
  useEffect(() => release, []);
  return (
    <div
      className="steer-zone joy-zone"
      aria-label="조이스틱: 왼쪽 아래를 누르고 가고 싶은 쪽으로 밀기"
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        e.preventDefault();
        pid.current = e.pointerId;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        originBox.current = { x: r.left, y: r.top };
        origin.current = { x: e.clientX, y: e.clientY };
        if (base.current) base.current.style.transform = `translate(${e.clientX - r.left - 70}px, ${e.clientY - r.top - 70}px)`;
        controls.armed = true;
        setActive(true);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pid.current === e.pointerId) move(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => pid.current === e.pointerId && release()}
      onPointerCancel={(e) => pid.current === e.pointerId && release()}
    >
      <div ref={base} className={active ? "joy-base on" : "joy-base"}>
        <span className="joy-mark up">▲</span>
        <span className="joy-mark down">브레이크</span>
        <div ref={knob} className="joy-knob">🚲</div>
      </div>
      {!active && <div className="steer-idle">🕹️ 여기를 누르고 가고 싶은 쪽으로 밀기</div>}
    </div>
  );
}

/** 휴대폰용 떠다니는 핸들: 화면 왼쪽 아래 아무 데나 대고 좌우로 끌면 됨 */
function SteerZone() {
  const knob = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const origin = useRef(0);
  const [active, setActive] = useState(false);
  const RANGE = 70;
  const place = (x: number, y: number) => {
    if (base.current) base.current.style.transform = `translate(${x - 60}px, ${y - 60}px)`;
  };
  const move = (clientX: number) => {
    let dx = clientX - origin.current;
    // 손가락이 많이 밀려나면 기준점도 따라옴 (끝까지 꺾은 상태 유지)
    if (Math.abs(dx) > RANGE) {
      origin.current += dx - Math.sign(dx) * RANGE;
      dx = Math.sign(dx) * RANGE;
    }
    if (knob.current) knob.current.style.transform = `translateX(${dx}px)`;
    const x = dx / RANGE;
    axis.steer = -Math.sign(x) * Math.pow(Math.abs(x), 1.2);
    axis.steerActive = true;
  };
  const release = () => {
    pid.current = null;
    setActive(false);
    if (knob.current) knob.current.style.transform = "translateX(0px)";
    axis.steer = 0;
    axis.steerActive = false;
  };
  return (
    <div
      className="steer-zone"
      aria-label="핸들: 왼쪽 아래를 누르고 좌우로 끌기"
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        e.preventDefault();
        pid.current = e.pointerId;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        origin.current = e.clientX;
        controls.armed = true;
        place(e.clientX - r.left, e.clientY - r.top);
        setActive(true);
        move(e.clientX);
      }}
      onPointerMove={(e) => {
        if (pid.current === e.pointerId) move(e.clientX);
      }}
      onPointerUp={(e) => pid.current === e.pointerId && release()}
      onPointerCancel={(e) => pid.current === e.pointerId && release()}
    >
      <div ref={base} className={active ? "steer-float on" : "steer-float"}>
        <span className="steer-hint">◀</span>
        <div ref={knob} className="steer-knob">🚲</div>
        <span className="steer-hint">▶</span>
      </div>
      {!active && <div className="steer-idle">👈 여기를 누르고 좌우로 👉</div>}
    </div>
  );
}

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
    setMap(profile.map ?? "village");
    resetRace();
    resetGroup();
    loadGhost(profile.map ?? "village");
    ensurePlayer(profile.nickname)
      .then((pl) => {
        setProfile((p) => (p ? { ...p, equip: pl.equipped, pid: pl.id, bikeName: p.bikeNames?.[p.bike] ?? p.bikeName } : p));
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
  const remotesRef = useRef<Map<string, Remote> | null>(null);
  const [, force] = useState(0);
  const net = useNet(
    profile,
    myId,
    (id) => {
      const r = remotesRef.current?.get(id);
      const d = r ? Math.hypot(r.cur.x - stats.x, r.cur.z - stats.z) : 0;
      sfx("bell", 1 - d / 60);
    },
    {
      onPoke: (p) => handlePoke.current(p),
      onInvite: (p) => {
        if (group.phase !== "idle" && group.phase !== "done") return;
        group.phase = "invited";
        group.hostId = p.hostId;
        group.hostName = p.hostName;
        group.goAt = now() + p.inSec;
        group.entries = [{ id: p.hostId, nickname: p.hostName }];
        group.joined = false;
        group.teleported = false;
        group.myFinish = null;
        sfx("bell");
        force((n) => n + 1);
      },
      onJoin: (p) => {
        if (group.phase === "idle") return;
        if (!group.entries.some((e) => e.id === p.id)) group.entries.push({ id: p.id, nickname: p.nickname });
        force((n) => n + 1);
      },
      onFinish: (p) => {
        const e = group.entries.find((x) => x.id === p.id);
        if (e) e.ms = p.ms;
        else if (group.phase !== "idle") group.entries.push({ id: p.id, nickname: p.nickname, ms: p.ms });
        force((n) => n + 1);
      },
    },
  );
  const { sendRace, sendPoke } = net;

  // ── 💬 1:1 대화 ──
  const [dmOpen, setDmOpen] = useState(false);
  const [dmTarget, setDmTarget] = useState<{ pid: string; nickname: string } | null>(null);
  const [dmUnread, setDmUnread] = useState(0);
  // 서버에 1:1 대화 기능이 준비됐는지 (없으면 버튼 숨김)
  const [dmReady, setDmReady] = useState(false);
  const [dmBump, setDmBump] = useState(0);
  const refreshUnread = useCallback(() => {
    if (!profile.pid) return;
    dmThreads()
      .then((t) => {
        setDmReady(true);
        setDmUnread(t.reduce((a, x) => a + Number(x.unread || 0), 0));
      })
      .catch(() => setDmReady(false));
  }, [profile.pid]);
  const dmNotify = useDMNotify(profile.pid, (from, fromName) => {
    setDmBump((n) => n + 1);
    refreshUnread();
    popups.push({ text: `📨 ${fromName}님의 1:1 메시지`, kind: "bonus" });
    sfx("bell", 0.6);
    void from;
  });
  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 30000);
    return () => clearInterval(id);
  }, [refreshUnread]);
  const openDM = (target: { pid: string; nickname: string } | null) => {
    setDmTarget(target);
    setDmOpen(true);
    setMenuOpen(false);
    setSelected(null);
    setChatOpen(false);
  };

  // ── 🤝 상호작용 ──
  const [selected, setSelected] = useState<string | null>(null);
  const [hfReq, setHfReq] = useState<{ from: string; name: string; at: number } | null>(null);
  const [busyGift, setBusyGift] = useState(false);
  const lastPoke = useRef(0);
  const pushToast = (text: string, kind: "trick" | "crash" | "bonus" = "bonus") => popups.push({ text, kind });
  const distTo = (id: string) => {
    const r = net.remotes.current.get(id);
    return r ? Math.hypot(r.cur.x - stats.x, r.cur.z - stats.z) : 999;
  };
  const doHighFive = (otherName: string) => {
    anim.emote = "cheer";
    anim.emoteAt = now();
    net.sendEmote("cheer");
    stats.stars += 1;
    sfx("ring");
    pushToast(`🖐️ ${otherName}님과 하이파이브! ⭐+1`, "trick");
  };
  const handlePoke = useRef<(p: import("./net").Poke) => void>(() => {});
  handlePoke.current = (p) => {
    p = { ...p, fromName: cleanText(p.fromName) };
    if (p.kind === "wave") {
      pushToast(`👋 ${p.fromName}님이 인사했어요!`);
      sfx("checkpoint");
    } else if (p.kind === "hf_req") {
      setHfReq({ from: p.from, name: p.fromName, at: Date.now() });
      sfx("bell");
    } else if (p.kind === "hf_ok") {
      doHighFive(p.fromName);
    } else if (p.kind === "gift" && p.amount) {
      setWalletBase((w) => (w === null ? w : w + (p.amount ?? 0)));
      pushToast(`🎁 ${p.fromName}님이 별 ${p.amount}개를 선물했어요!`, "trick");
      sfx("buy");
    }
  };
  const poke = (id: string, kind: "wave" | "hf_req") => {
    if (Date.now() - lastPoke.current < 1500) return;
    lastPoke.current = Date.now();
    const name = net.players.find((x) => x.id === id)?.nickname ?? "";
    if (kind === "wave") {
      doEmote("wave");
      pushToast(`👋 ${name}님에게 인사했어요`);
    } else {
      pushToast(`🖐️ ${name}님에게 하이파이브를 청했어요`);
    }
    sendPoke({ fromName: profile.nickname, to: id, kind });
  };
  const sendGift = async (id: string, amount: number) => {
    const target = net.players.find((x) => x.id === id);
    if (!target?.pid || busyGift) return;
    setBusyGift(true);
    try {
      await autosave(false); // 방금 주운 별부터 저장
      const me = await giftStars(target.pid, amount);
      setWalletBase(me.stars + (stats.stars - saved.current.stars));
      sendPoke({ fromName: profile.nickname, to: id, kind: "gift", amount });
      pushToast(`🎁 ${target.nickname}님에게 별 ${amount}개를 선물했어요`, "trick");
      sfx("buy");
    } catch (e) {
      pushToast(`😢 ${(e as Error).message}`, "crash");
    } finally {
      setBusyGift(false);
    }
  };

  const openRace = () => {
    if (group.phase !== "idle" && group.phase !== "done") return;
    resetGroup();
    group.phase = "waiting";
    group.hostId = myId;
    group.hostName = profile.nickname;
    group.goAt = now() + 15;
    group.joined = true;
    group.slot = 0;
    group.entries = [{ id: myId, nickname: profile.nickname }];
    sendRace("race_invite", { hostId: myId, hostName: profile.nickname, inSec: 15 });
    setMenuOpen(false);
    force((n) => n + 1);
  };
  const joinRace = () => {
    if (group.phase !== "invited") return;
    group.phase = "waiting";
    group.joined = true;
    group.slot = group.entries.length;
    if (!group.entries.some((e) => e.id === myId)) group.entries.push({ id: myId, nickname: profile.nickname });
    sendRace("race_join", { id: myId, nickname: profile.nickname });
    force((n) => n + 1);
  };

  // 레이스 진행 관리: 초대 만료, 내 완주 방송, 종료
  const lastBeep = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      const t = now();
      if (group.phase === "invited" && t > group.goAt) {
        resetGroup();
        force((n) => n + 1);
      }
      if (group.phase === "waiting" && group.teleported) {
        const left = Math.ceil(group.goAt - t);
        if (left >= 1 && left <= 3 && left !== lastBeep.current) {
          lastBeep.current = left;
          sfx("checkpoint");
        }
      }
      if (group.phase === "racing" && group.myFinish !== null) {
        const me = group.entries.find((e) => e.id === myId);
        if (me && me.ms === undefined) {
          me.ms = group.myFinish;
          sendRace("race_finish", { id: myId, nickname: profile.nickname, ms: group.myFinish });
        }
      }
      if (group.phase === "racing") {
        const allDone = group.entries.every((e) => e.ms !== undefined);
        if (allDone || t > group.goAt + 240) {
          group.phase = "done";
          group.goAt = t; // 결과 표시 시작 시각
          race.running = false;
          race.next = 0;
        }
      }
      if (group.phase === "done" && t - group.goAt > 10) {
        resetGroup();
        race.next = 0;
      }
    }, 200);
    return () => clearInterval(id);
  }, [myId, profile.nickname, sendRace]);

  // 📸 사진 찍기
  const [photoMode, setPhotoMode] = useState(false);
  const [flash, setFlash] = useState(false);
  const takePhoto = () => {
    setMenuOpen(false);
    setPhotoMode(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        const src = document.querySelector(".game canvas") as HTMLCanvasElement | null;
        setPhotoMode(false);
        if (!src) return;
        setFlash(true);
        setTimeout(() => setFlash(false), 350);
        sfx("buy");
        const c = document.createElement("canvas");
        c.width = src.width;
        c.height = src.height;
        const ctx2 = c.getContext("2d");
        if (!ctx2) return;
        ctx2.drawImage(src, 0, 0);
        const fs = Math.round(c.width / 32);
        ctx2.font = `bold ${fs}px "Jua", sans-serif`;
        ctx2.fillStyle = "rgba(255,255,255,0.9)";
        ctx2.shadowColor = "rgba(0,0,0,0.35)";
        ctx2.shadowBlur = fs / 3;
        ctx2.fillText(`🚲 자전거로어스 · ${map.name}`, fs * 0.8, c.height - fs * 0.9);
        const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
        if (!blob) return;
        const file = new File([blob], `bicycleroers-${Date.now()}.png`, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
        if (isTouch && nav.canShare?.({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: "자전거로어스" });
            return;
          } catch {
            /* 취소하면 저장으로 */
          }
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }),
    );
  };
  remotesRef.current = net.remotes.current;
  const map = getMap();
  const [muted, setMutedState] = useState(isMuted());
  const { sendBell } = net;
  const lastBell = useRef(0);
  const ringBell = useCallback(() => {
    if (Date.now() - lastBell.current < 1200) return;
    lastBell.current = Date.now();
    sfx("bell");
    sendBell();
  }, [sendBell]);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const spec = getBike(profile.bike);

  const [hud, setHud] = useState({
    speed: 0, dist: 0, stars: 0, trick: 0, air: false, boost: false,
    raceOn: false, raceT: 0, raceNext: 0, raceTotal: 0, raceBest: 0,
  });
  const [toasts, setToasts] = useState<{ id: number; text: string; kind: string }[]>([]);
  const toastId = useRef(0);
  const [, setTick] = useState(0);
  const isTouch = useMemo(
    () => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760),
    [],
  );
  const [chatOpen, setChatOpen] = useState(!isTouch);
  const [, setCtl] = useState(0);
  useState(() => {
    loadControls(isTouch);
    controls.armed = false;
  });
  const toggleCtl = async (k: "autoPedal" | "haptics" | "tilt") => {
    if (k === "tilt") {
      if (!controls.tilt) {
        const ok = await enableTilt();
        if (!ok) {
          popups.push({ text: "기울기 센서를 쓸 수 없어요 (권한 확인)", kind: "crash" });
          return;
        }
        controls.tilt = true;
        popups.push({ text: "📱 지금 자세가 기준이에요. 좌우로 기울여 보세요", kind: "bonus" });
      } else {
        disableTilt();
        controls.tilt = false;
      }
    } else {
      controls[k] = !controls[k];
      if (k === "haptics" && controls.haptics) navigator.vibrate?.(30);
    }
    saveControls();
    setCtl((n) => n + 1);
  };
  const cycleSens = () => {
    controls.sensitivity = controls.sensitivity < 0.9 ? 1 : controls.sensitivity < 1.2 ? 1.35 : 0.7;
    saveControls();
    setCtl((n) => n + 1);
  };
  const [unread, setUnread] = useState(0);
  const seenCount = useRef(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const chatInput = useRef<HTMLInputElement>(null);
  const chatList = useRef<HTMLDivElement>(null);
  const lastChat = useRef(0);
  const [viewMode, setViewMode] = useState(view.mode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [emoteOpen, setEmoteOpen] = useState(false);
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
      else if (code === "KeyT") ringBell();
      else if (code === "Enter") {
        setChatOpen(true);
        setTimeout(() => chatInput.current?.focus(), 0);
      } else {
        if (code === "KeyQ" || code === "KeyE") queueTrick("auto");
      }
    });
  }, [doEmote, cycleView, ringBell]);

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
      if (raceResults.length) {
        const rows = raceResults.splice(0).map((ms) => ({ map: getMap().id, nickname: profile.nickname, bike: profile.bike, ms }));
        void supabase.from("bike_times").insert(rows);
      }
      setHud({
        speed: stats.speed, dist: stats.dist, stars: stats.stars, trick: stats.trickScore,
        air: stats.airborne, boost: stats.boosting,
        raceOn: race.running, raceT: race.running ? performance.now() / 1000 - race.start : race.last,
        raceNext: race.next, raceTotal: race.total, raceBest: race.best,
      });
      if (++n % 2 === 0) {
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

  type HoldKey = "f" | "b" | "l" | "r" | "jump";
  const hold = (k: HoldKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      if (k === "jump") input.jumpTaps++;
      controls.armed = true;
      input[k] = true;
    },
    onPointerUp: () => (input[k] = false),
    onPointerLeave: () => (input[k] = false),
    onPointerCancel: () => (input[k] = false),
  });

  const chatPanel = (
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
  );

  const changeMap = async (id: string) => {
    if (id === map.id) return;
    setMenuOpen(false);
    popups.push({ text: "🗺️ 맵을 옮기는 중… 기록 저장할게요", kind: "bonus" });
    await autosave(false);
    const cur = loadProfile();
    if (cur) saveProfile({ ...cur, map: id as Profile["map"] });
    window.location.reload();
  };
  const mapPicker = (
    <div className="map-pick">
      <b>🗺️ 맵 바꾸기</b>
      <div className="map-pick-row">
        {MAP_INFO.map((m) => (
          <button key={m.id} className={m.id === map.id ? "chip on" : "chip"} onClick={() => changeMap(m.id)}>
            {m.emoji} {m.name}
          </button>
        ))}
      </div>
    </div>
  );

  const walletNow = walletBase !== null ? walletBase + hud.stars - saved.current.stars : null;

  return (
    <div className={`game${isTouch ? " touch-ui" : ""}${photoMode ? " photo" : ""}`}>
      <Canvas
        shadows
        dpr={isTouch ? [1, 1.5] : [1, 2]}
        camera={{ fov: 60, near: 0.1, far: 600, position: [0, 5, -70] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[map.sky.bg]} />
        <fog attach="fog" args={[map.sky.bg, map.sky.fog[0], map.sky.fog[1]]} />
        <hemisphereLight args={map.sky.hemi} />
        <ambientLight intensity={0.35} />
        <World />
        <GhostRider />
        <Player profile={profile} anim={anim} myId={myId} lowPower={isTouch} bubble={bubbleOf(myId)} sendMove={net.sendMove} sendTrick={net.sendTrick} remotes={net.remotes} />
        {net.players.map((p) => (
          <RemoteRider key={p.id} player={p} remote={net.remotes.current.get(p.id)} bubble={bubbleOf(p.id)} onSelect={(id) => { setSelected(id); setMenuOpen(false); }} />
        ))}
      </Canvas>

      {/* 상단 HUD (PC) */}
      {!isTouch && (
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
            <div><span className="big">⭐ {walletNow ?? hud.stars}</span>{hud.stars > 0 && <small>+{hud.stars}</small>}</div>
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
                <button className="linkish" onClick={() => setSelected(p.id)}>
                  <span className="dot" style={{ background: p.color }} />
                  {getBike(p.bike).emoji} {p.nickname}
                </button>
              </li>
            ))}
            {net.players.length > 8 && <li className="muted">외 {net.players.length - 8}명</li>}
          </ul>
          <div className="row">
            <button
              className="btn small ghost"
              aria-label={muted ? "소리 켜기" : "소리 끄기"}
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
              }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button className="btn small ghost" onClick={cycleView}>
              🎥<span className="lbl"> {viewMode === "chase" ? "뒤에서" : viewMode === "front" ? "앞에서" : "위에서"}</span>
            </button>
            <button className="btn small ghost" onClick={takePhoto} aria-label="사진 찍기">📸</button>
          </div>
          <div className="row">
            <button className="btn small ghost" onClick={openRace} disabled={group.phase !== "idle" && group.phase !== "done"}>
              🏁 다 같이 레이스
            </button>
            <button className="btn small ghost" onClick={() => setMenuOpen((o) => !o)}>🗺️ 맵</button>
            {dmReady && (
              <button className="btn small ghost" onClick={() => (dmOpen ? setDmOpen(false) : openDM(null))}>
                📨{dmUnread > 0 && <span className="badge">{dmUnread}</span>}
              </button>
            )}
          </div>
          {menuOpen && !isTouch && <div className="desk-map">{mapPicker}</div>}
          <div className="row">
            <button className="btn small" onClick={exit} disabled={saving}>
              {saving ? "저장 중…" : <>🏁<span className="lbl"> 그만 타기</span></>}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* 상단 HUD (휴대폰): 꼭 필요한 것만 */}
      {isTouch && (
        <>
          <div className="m-stat">
            <b>{Math.round(hud.speed * 3.6)}</b><small>km/h</small>
            <span>⭐{walletNow ?? hud.stars}</span>
            {hud.trick > 0 && <span>🤸{hud.trick}</span>}
          </div>
          <div className="m-top-btns">
            <button className="m-icon" aria-label="채팅" onClick={() => { setChatOpen((o) => !o); setMenuOpen(false); }}>
              💬{!chatOpen && unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
            </button>
            {dmReady && (
              <button className="m-icon" aria-label="1:1 대화함" onClick={() => (dmOpen ? setDmOpen(false) : openDM(null))}>
                📨{dmUnread > 0 && <span className="badge">{dmUnread > 9 ? "9+" : dmUnread}</span>}
              </button>
            )}
            <button className="m-icon" aria-label="메뉴" onClick={() => { setMenuOpen((o) => !o); setChatOpen(false); setDmOpen(false); }}>
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
          {menuOpen && (
            <div className="m-sheet panel">
              <div className="m-sheet-row">
                <span className={net.connected ? "live on" : "live"} /> 접속 {net.players.length + 1}명
                {walletNow !== null && <span className="wallet">보유 ⭐ <b>{walletNow}</b></span>}
              </div>
              <div className="m-players">
                {[{ id: "me", nickname: profile.nickname, color: profile.color, bike: profile.bike }, ...net.players].slice(0, 12).map((p) => (
                  <button
                    key={p.id}
                    className="m-player"
                    disabled={p.id === "me"}
                    onClick={() => { setSelected(p.id); setMenuOpen(false); }}
                  >
                    <span className="dot" style={{ background: p.color }} />{getBike(p.bike).emoji} {p.nickname}
                  </button>
                ))}
              </div>
              {mapPicker}
              <div className="m-ctl">
                <b>🎮 조작 설정</b>
                <div className="m-ctl-grid">
                  <button className="chip on" onClick={() => { controls.steerMode = controls.steerMode === "joystick" ? "pad" : "joystick"; saveControls(); setCtl((n) => n + 1); }}>
                    {controls.steerMode === "joystick" ? "🕹️ 조이스틱" : "🎡 핸들+페달"} (바꾸기)
                  </button>
                  <button className={controls.autoPedal ? "chip on" : "chip"} onClick={() => toggleCtl("autoPedal")}>🦶 자동 페달 {controls.autoPedal ? "ON" : "OFF"}</button>
                  <button className={controls.tilt ? "chip on" : "chip"} onClick={() => toggleCtl("tilt")}>📱 기울여 조종 {controls.tilt ? "ON" : "OFF"}</button>
                  <button className="chip" onClick={cycleSens}>🎚️ 핸들 감도 {controls.sensitivity < 0.9 ? "낮음" : controls.sensitivity < 1.2 ? "보통" : "높음"}</button>
                  <button className={controls.haptics ? "chip on" : "chip"} onClick={() => toggleCtl("haptics")}>📳 진동 {controls.haptics ? "ON" : "OFF"}</button>
                  {controls.tilt && <button className="chip" onClick={() => { recenterTilt(); popups.push({ text: "📱 지금 자세를 기준으로 맞췄어요", kind: "bonus" }); }}>🎯 기울기 0점 맞추기</button>}
                </div>
              </div>
              <div className="m-sheet-btns">
                <button className="btn small ghost" onClick={() => { setMuted(!muted); setMutedState(!muted); }}>
                  {muted ? "🔇 소리 꺼짐" : "🔊 소리 켜짐"}
                </button>
                <button className="btn small ghost" onClick={cycleView}>
                  🎥 {viewMode === "chase" ? "뒤에서" : viewMode === "front" ? "앞에서" : "위에서"}
                </button>
                <button className="btn small ghost" onClick={takePhoto}>📸 사진 찍기</button>
                <button className="btn small ghost" onClick={openRace} disabled={group.phase !== "idle" && group.phase !== "done"}>
                  🏁 다 같이 레이스
                </button>
                <button className="btn small" onClick={exit} disabled={saving}>
                  {saving ? "저장 중…" : "🚪 그만 타기"}
                </button>
              </div>
            </div>
          )}
          {chatOpen && <div className="m-chat">{chatPanel}</div>}
        </>
      )}

      {/* 타임어택 */}
      {(hud.raceOn || hud.raceBest > 0) && (
        <div className={hud.raceOn ? "racebar on" : "racebar"}>
          <span className="race-name">⏱️ {map.course.name}</span>
          <b>{fmtTime(hud.raceT)}</b>
          {hud.raceOn && (
            <span className="muted">
              {isTouch
                ? `${map.course.kind === "lap" && hud.raceNext === 0 ? hud.raceTotal : hud.raceNext}/${hud.raceTotal}`
                : map.course.kind === "lap"
                  ? `체크포인트 ${hud.raceNext === 0 ? hud.raceTotal : hud.raceNext}/${hud.raceTotal}`
                  : `게이트 ${hud.raceNext}/${hud.raceTotal}`}
            </span>
          )}
          {hud.raceBest > 0 && !(isTouch && hud.raceOn) && <span className="best">최고 {fmtTime(hud.raceBest)}</span>}
        </div>
      )}

      {dmOpen && dmReady && profile.pid && (
        <DMPanel myPid={profile.pid} myName={profile.nickname} target={dmTarget} onClose={() => { setDmOpen(false); refreshUnread(); }} notify={dmNotify} bump={dmBump} />
      )}

      {/* 🤝 상호작용 */}
      {selected && (() => {
        const tp = net.players.find((x) => x.id === selected);
        if (!tp) return null;
        const d = Math.round(distTo(tp.id));
        const near = d < 12;
        return (
          <div className="interact panel">
            <div className="interact-head">
              <span className="dot" style={{ background: tp.color }} />
              <b>{getBike(tp.bike).emoji} {cleanText(tp.nickname)}</b>
              {tp.bikeName && <span className="muted">「{tp.bikeName}」</span>}
              <span className="muted">· {d < 999 ? `${d}m` : "멀리"}</span>
              <button className="x" aria-label="닫기" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="interact-btns">
              <button className="btn small ghost" onClick={() => poke(tp.id, "wave")}>👋 인사</button>
              {dmReady && (
                <button className="btn small ghost" disabled={!tp.pid || !profile.pid} onClick={() => tp.pid && openDM({ pid: tp.pid, nickname: tp.nickname })}>💬 1:1 대화</button>
              )}
              <button className="btn small ghost" disabled={!near} onClick={() => poke(tp.id, "hf_req")} title={near ? "" : "12m 안으로 가까이 가야 해요"}>
                🖐️ 하이파이브{!near && " (가까이!)"}
              </button>
            </div>
            <div className="interact-btns">
              <span className="muted">🎁 별 선물</span>
              {[1, 5, 10].map((n) => (
                <button key={n} className="btn small buy" disabled={busyGift || !tp.pid || (walletNow ?? 0) < n} onClick={() => sendGift(tp.id, n)}>
                  ⭐{n}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {hfReq && Date.now() - hfReq.at < 10000 && (
        <div className="group-banner hf">
          <span>🖐️ <b>{hfReq.name}</b>님이 하이파이브를 청해요!</span>
          <button
            className="btn small"
            onClick={() => {
              sendPoke({ fromName: profile.nickname, to: hfReq.from, kind: "hf_ok" });
              doHighFive(hfReq.name);
              setHfReq(null);
            }}
          >
            🖐️ 짝!
          </button>
          <button className="btn small ghost" onClick={() => setHfReq(null)}>다음에</button>
        </div>
      )}
      {stats.drafting && <div className="draft-tag">🌬️ 슬립스트림</div>}

      {/* 다 같이 레이스 */}
      {group.phase === "invited" && (
        <div className="group-banner">
          <span>🏁 <b>{group.hostName}</b>님이 {map.course.name} 레이스를 열었어요! ({Math.max(0, Math.ceil(group.goAt - now()))}초)</span>
          <button className="btn small" onClick={joinRace}>참가하기</button>
        </div>
      )}
      {group.phase === "waiting" && !group.teleported && (
        <div className="group-banner">
          <span>🏁 레이스 출발까지 <b>{Math.max(0, Math.ceil(group.goAt - now()))}</b>초 · 참가 {group.entries.length}명 — 곧 출발선으로 이동해요</span>
        </div>
      )}
      {group.phase === "waiting" && group.teleported && now() < group.goAt && (
        <div className="countdown">{Math.max(1, Math.ceil(group.goAt - now()))}</div>
      )}
      {group.phase === "racing" && now() - group.goAt < 0.8 && <div className="countdown go">GO!</div>}
      {(group.phase === "racing" || group.phase === "done") && (
        <div className="group-results panel">
          <b>{group.phase === "done" ? "🏆 레이스 결과" : "🏁 레이스 중"}</b>
          <ol>
            {[...group.entries]
              .sort((a, b) => (a.ms ?? 1e12) - (b.ms ?? 1e12))
              .map((e, i) => (
                <li key={e.id} className={e.id === myId ? "me" : ""}>
                  <span>{e.ms !== undefined ? ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.` : "🚴"}</span>
                  <span className="nm">{e.nickname}</span>
                  <span>{e.ms !== undefined ? fmtTime(e.ms / 1000) : "달리는 중"}</span>
                </li>
              ))}
          </ol>
        </div>
      )}
      {ghost.best && !hud.raceOn && group.phase === "idle" && !isTouch && (
        <div className="ghost-hint">👻 내 최고 {fmtTime(ghost.best.ms / 1000)} — 출발 게이트를 지나면 고스트와 함께 달려요</div>
      )}
      {flash && <div className="photo-flash" />}

      {/* 묘기 알림 */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
        ))}
      </div>
      {hud.boost && <div className="boost-fx" />}
      <div className="speedlines" style={{ opacity: Math.max(0, Math.min(0.9, (hud.speed - spec.maxSpeed * 0.75) / (spec.maxSpeed * 0.6))) }} />

      {/* 묘기 버튼 */}
      {!isTouch && (
        <button
          className={hud.air ? "btn trick-one air" : "btn trick-one"}
          onPointerDown={(e) => {
            e.preventDefault();
            queueTrick("auto");
          }}
        >
          🤸 묘기 <kbd>공중에서 Space</kbd>
        </button>
      )}

      {/* 감정표현 */}
      {isTouch && (
        <button className="m-emote-toggle" aria-label="감정표현" onClick={() => setEmoteOpen((o) => !o)}>
          {emoteOpen ? "✕" : "😀"}
        </button>
      )}
      {(!isTouch || emoteOpen) && (
      <div className={isTouch ? "emotes m-emotes" : "emotes"}>
        <button className="btn emote bell" onClick={() => { ringBell(); setEmoteOpen(false); }} aria-label="따릉따릉">
          <span className="e-ico">🔔</span>
          <span className="e-txt">따릉</span> <kbd>T</kbd>
        </button>
        {EMOTES.map((e) => (
          <button key={e.id} className="btn emote" onClick={() => { doEmote(e.id); setEmoteOpen(false); }} aria-label={e.label}>
            <span className="e-ico">{e.label.split(" ")[0]}</span>
            <span className="e-txt">{e.label.split(" ")[1]}</span> <kbd>{e.key}</kbd>
          </button>
        ))}
      </div>
      )}

      {!isTouch && chatPanel}

      {/* 모바일 컨트롤: 왼손 방향, 오른손 페달/브레이크/점프 */}
      {isTouch && !controls.tilt && (controls.steerMode === "joystick" ? <Joystick /> : <SteerZone />)}
      <div className={controls.steerMode === "joystick" && !controls.tilt ? "touch touch-right joy-mode" : "touch touch-right"}>
        <button className="tbtn small" aria-label="브레이크" {...hold("b")}>▼</button>
        <div className="col">
          <button className={hud.air ? "tbtn jump air" : "tbtn jump"} aria-label={hud.air ? "묘기" : "점프"} {...hold("jump")}>
            {hud.air ? "🤸 묘기" : "점프"}
          </button>
          <button className="tbtn pedal" aria-label="페달" {...hold("f")}>
            {controls.autoPedal ? "🚀 힘껏" : "▲ 페달"}
          </button>
        </div>
      </div>

      {!isTouch && <div className="help">W/↑ 페달 · S/↓ 브레이크 · A D 방향 · S+방향 드리프트 · Space 점프 · 공중에서 한 번 더 = 묘기 · T 따릉 · V 카메라 · Enter 채팅 · 🎮 게임패드 OK</div>}
    </div>
  );
}
