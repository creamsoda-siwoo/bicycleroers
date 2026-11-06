"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getBike } from "@/lib/bikes";
import { EMOTE_DUR, TRICK_MAP, type Profile, type TrickId } from "@/lib/profile";
import {
  BOOSTS, HOOPS, PLAZA_RADIUS, SKATE, SPAWN, TRACK_RADIUS, TRACK_WIDTH, groundHeight, inPond, randomStarPos, resolveCollisions,
} from "@/lib/world";
import { hoopFlash } from "../three/Landmarks";
import { Rider } from "../three/Rider";
import { Trail } from "../three/Custom";
import { stars } from "../three/World";
import { CRASH_DUR, now, type AnimState } from "../three/anim";
import { input, trickQueue } from "./input";
import type { Bubble, MovePayload, NetPlayer, Remote } from "./net";

export const stats = { speed: 0, dist: 0, stars: 0, x: 0, z: 0, trickScore: 0, airborne: false, boosting: false };

/** 화면 가운데 띄울 알림 (묘기 점수 등) */
export const popups: { text: string; kind: "trick" | "crash" | "bonus" }[] = [];

/** 자전거별 묘기 점수 배율 */
const TRICK_MULT: Record<string, number> = {
  bmx: 1.5, mtb: 1.2, unicycle: 2, tricycle: 2, tandem: 1.8, cruiser: 1.3,
};
export const view = { mode: "chase" as "chase" | "front" | "top" };

const GRAVITY = 18;

function slopePitch(x: number, z: number, h: number) {
  const fx = Math.sin(h) * 0.5;
  const fz = Math.cos(h) * 0.5;
  const a = groundHeight(x + fx, z + fz);
  const b = groundHeight(x - fx, z - fz);
  return -Math.atan2(a - b, 1);
}

function onPavement(x: number, z: number) {
  const d = Math.hypot(x, z);
  if (Math.abs(d - TRACK_RADIUS) < TRACK_WIDTH / 2) return true;
  if (d < PLAZA_RADIUS) return true;
  if (Math.hypot(x - SKATE.x, z - SKATE.z) < SKATE.r) return true;
  if ((Math.abs(x) < 2 || Math.abs(z) < 2) && d < TRACK_RADIUS) return true;
  return false;
}

export function Player({
  profile,
  anim,
  myId,
  bubble,
  sendMove,
  sendTrick,
  lowPower,
}: {
  sendTrick: (t: TrickId | "crash") => void;
  profile: Profile;
  anim: AnimState;
  myId: string;
  lowPower?: boolean;
  bubble: string | null;
  sendMove: (p: MovePayload) => void;
}) {
  const spec = getBike(profile.bike);
  const outer = useRef<THREE.Group>(null);
  const pitchG = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const { camera, scene } = useThree();
  const st = useRef({
    x: SPAWN.x + (Math.random() - 0.5) * 4,
    y: 0,
    z: SPAWN.z + (Math.random() - 0.5) * 3,
    h: SPAWN.heading,
    speed: 0,
    vy: 0,
    grounded: true,
    pitch: 0,
    lastSend: 0,
    lastSig: "",
    boostUntil: 0,
    stunUntil: 0,
    airStart: 0,
    combo: [] as TrickId[],
    hoopAt: HOOPS.map(() => -10),
  });
  const lookAt = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3()).current;

  useEffect(() => {
    // 테스트용: ?debug 로 열면 window.__teleport(x, z, heading) 사용 가능
    if (typeof window !== "undefined" && window.location.search.includes("debug")) {
      (window as unknown as Record<string, unknown>).__teleport = (x: number, z: number, h = 0) => {
        Object.assign(st.current, { x, z, h, y: groundHeight(x, z), speed: 0, vy: 0, grounded: true });
      };
    }
    if (light.current) scene.add(light.current.target);
    camera.position.set(st.current.x - 8, 4, st.current.z);
  }, [camera, scene]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const t = now();
    const stunned = t < s.stunUntil;
    const bowing = (anim.emote === "bow" && t - anim.emoteAt < EMOTE_DUR.bow) || stunned;

    // ── 부스터 ──
    if (s.grounded) {
      for (const b of BOOSTS) {
        if (Math.hypot(b.x - s.x, b.z - s.z) < 2.2 && t > s.boostUntil - 1.2) {
          s.boostUntil = t + 1.6;
          s.speed = Math.max(s.speed, spec.maxSpeed * 1.4);
          popups.push({ text: "🚀 부스터!", kind: "bonus" });
        }
      }
    }
    const boosting = t < s.boostUntil;

    // ── 속도 ──
    const paved = onPavement(s.x, s.z);
    const wet = inPond(s.x, s.z) && s.y < 0.2;
    anim.wet = wet;
    let cap = spec.maxSpeed * (paved || spec.id === "mtb" ? 1 : 0.72);
    if (boosting) cap = spec.maxSpeed * 1.6;
    if (wet) cap = 2.5;
    if (!bowing && input.f) s.speed += spec.accel * dt * (boosting ? 2 : 1);
    else if (!bowing && input.b) s.speed -= (s.speed > 0 ? spec.accel * 1.8 : spec.accel * 0.5) * dt;
    else s.speed -= s.speed * (s.grounded ? 0.9 : 0.1) * dt;
    if (bowing) s.speed *= Math.max(0, 1 - 5 * dt);
    if (s.speed > cap) s.speed += (cap - s.speed) * Math.min(1, 3 * dt);
    s.speed = Math.max(-spec.maxSpeed * 0.3, s.speed);
    if (Math.abs(s.speed) < 0.02 && !input.f && !input.b) s.speed = 0;

    // ── 방향 ──
    const steer = bowing ? 0 : (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const turnFactor = Math.min(1, Math.abs(s.speed) / 2.5) * (s.speed < 0 ? -1 : 1);
    s.h += steer * spec.turn * turnFactor * dt * (s.grounded ? 1 : 0.5);

    // ── 이동 + 충돌 ──
    const px = s.x;
    const pz = s.z;
    s.x += Math.sin(s.h) * s.speed * dt;
    s.z += Math.cos(s.h) * s.speed * dt;
    const g0 = groundHeight(s.x, s.z);
    if (s.grounded && g0 - s.y > 0.45) {
      // 점프대 옆면에 부딪힘
      s.x = px;
      s.z = pz;
      s.speed *= -0.3;
    }
    const moveWant = Math.hypot(s.x - px, s.z - pz);
    resolveCollisions(s, 0.55);
    const got = Math.hypot(s.x - px, s.z - pz);
    if (moveWant > 0.0001 && got < moveWant * 0.6) s.speed *= 0.92;

    // ── 높이 / 점프 ──
    const g = groundHeight(s.x, s.z);
    if (s.grounded) {
      if (input.jump && !bowing) {
        s.vy = spec.jump;
        s.grounded = false;
        s.airStart = t;
      } else if (g < s.y - 0.08) {
        s.grounded = false; // 점프대 끝에서 날아오름 (경사 속도 유지)
        if (s.vy > 0.5) s.vy += 2.5 + Math.abs(s.speed) * 0.25;
        s.airStart = t;
      } else {
        s.vy = Math.min(12, (g - s.y) / Math.max(dt, 0.001));
        s.y = g;
      }
    }
    if (!s.grounded) {
      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y <= g) {
        s.y = g;
        s.vy = 0;
        s.grounded = true;
        // ── 착지 판정 ──
        let crashed = false;
        if (anim.trick) {
          const p = (t - anim.trickAt) / TRICK_MAP[anim.trick].dur;
          if (p < 0.82) crashed = true;
          else s.combo.push(anim.trick);
          anim.trick = null;
        }
        if (crashed) {
          s.combo = [];
          s.speed = 0;
          s.stunUntil = t + CRASH_DUR;
          anim.crashAt = t;
          sendTrick("crash");
          popups.push({ text: "💥 꽈당!", kind: "crash" });
        } else if (s.combo.length > 0) {
          const base = s.combo.reduce((a, id) => a + TRICK_MAP[id].pts, 0);
          const air = Math.max(0, t - s.airStart);
          const mult = s.combo.length * (TRICK_MULT[spec.id] ?? 1);
          const pts = Math.round((base + air * 100) * mult);
          stats.trickScore += pts;
          const names = s.combo.map((id) => TRICK_MAP[id].name).join(" + ");
          popups.push({
            text: `${names}${s.combo.length > 1 ? ` 콤보 x${s.combo.length}` : ""}  +${pts}`,
            kind: "trick",
          });
          s.combo = [];
        }
      }
    }

    // ── 묘기 시작 (공중에서만) ──
    // 버튼을 조금 일찍 눌러도 0.4초 동안 기억했다가 공중에 뜨면 실행
    const want = trickQueue.id;
    if (want && !s.grounded && !stunned && !anim.trick && s.y - g > 0.35) {
      trickQueue.id = null;
      anim.trick = want;
      anim.trickAt = t;
      sendTrick(want);
    } else if (want && t - trickQueue.at > 0.4) {
      trickQueue.id = null;
      if (s.grounded && !stunned) popups.push({ text: "점프해서 공중에서 묘기! (Space)", kind: "bonus" });
    }
    if (anim.trick) {
      const p = (t - anim.trickAt) / TRICK_MAP[anim.trick].dur;
      if (p >= 1) {
        s.combo.push(anim.trick);
        anim.trick = null;
      }
    }

    // ── 공중 링 통과 ──
    for (let i = 0; i < HOOPS.length; i++) {
      const h = HOOPS[i];
      if (t - s.hoopAt[i] < 3) continue;
      if (Math.hypot(h.x - s.x, h.y - (s.y + 0.9), h.z - s.z) < h.r + 0.3) {
        s.hoopAt[i] = t;
        hoopFlash[i] = t;
        stats.stars += 3;
        stats.trickScore += 250;
        popups.push({ text: "💫 링 통과! ⭐+3 +250", kind: "bonus" });
      }
    }
    stats.airborne = !s.grounded;
    stats.boosting = boosting;

    // ── 애니메이션 상태 ──
    anim.speed = s.speed;
    anim.dist += s.speed * dt;
    anim.lean = steer * Math.min(1, Math.abs(s.speed) / 6) * 0.32;
    const targetPitch = s.grounded
      ? slopePitch(s.x, s.z, s.h)
      : -Math.atan2(s.vy, Math.max(4, Math.abs(s.speed))) * 0.6;
    s.pitch += (targetPitch - s.pitch) * Math.min(1, 10 * dt);

    if (outer.current) {
      outer.current.position.set(s.x, s.y, s.z);
      outer.current.rotation.y = s.h;
    }
    if (pitchG.current) pitchG.current.rotation.x = s.pitch;

    // ── 별 수집 ──
    for (const star of stars) {
      if (Math.hypot(star.x - s.x, star.z - s.z) < 1.7 && s.y < 3) {
        stats.stars += 1;
        const [nx, nz] = randomStarPos();
        star.x = nx;
        star.z = nz;
      }
    }

    stats.speed = Math.abs(s.speed);
    stats.dist += Math.abs(s.speed) * dt;
    stats.x = s.x;
    stats.z = s.z;

    // ── 카메라 ──
    const sin = Math.sin(s.h);
    const cos = Math.cos(s.h);
    const mode = bowing && !stunned ? "front" : view.mode;
    let cx: number, cy: number, cz: number;
    if (mode === "front") {
      // 옆-앞에서 캐릭터 얼굴 보기 (로컬 x=2.6, z=4.2)
      cx = s.x + cos * 2.6 + sin * 4.2;
      cz = s.z - sin * 2.6 + cos * 4.2;
      cy = s.y + (bowing ? 1.5 : 2.0);
      tmp.set(s.x + cos * 0.6, s.y + 0.9, s.z - sin * 0.6);
    } else if (mode === "top") {
      cx = s.x - sin * 3;
      cz = s.z - cos * 3;
      cy = s.y + 18;
      tmp.set(s.x, s.y, s.z);
    } else {
      const back = 6 + Math.abs(s.speed) * 0.12;
      cx = s.x - sin * back;
      cz = s.z - cos * back;
      cy = s.y + 2.8;
      tmp.set(s.x + sin * 2, s.y + 1.1, s.z + cos * 2);
    }
    const cam = camera as THREE.PerspectiveCamera;
    const fov = boosting ? 72 : 60;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov += (fov - cam.fov) * Math.min(1, 4 * dt);
      cam.updateProjectionMatrix();
    }
    const k = 1 - Math.exp(-4 * dt);
    camera.position.x += (cx - camera.position.x) * k;
    camera.position.y += (Math.max(cy, groundHeight(cx, cz) + 0.5) - camera.position.y) * k;
    camera.position.z += (cz - camera.position.z) * k;
    lookAt.current.lerp(tmp, 1 - Math.exp(-8 * dt));
    camera.lookAt(lookAt.current);

    // ── 그림자 조명이 플레이어를 따라감 ──
    if (light.current) {
      light.current.position.set(s.x + 20, 35, s.z + 12);
      light.current.target.position.set(s.x, 0, s.z);
    }

    // ── 위치 전송 (약 8Hz, 정지 시 1초마다) ──
    const sig = `${s.x.toFixed(1)},${s.z.toFixed(1)},${s.y.toFixed(1)},${s.h.toFixed(2)}`;
    const interval = sig === s.lastSig ? 1 : 0.12;
    if (t - s.lastSend > interval) {
      s.lastSend = t;
      s.lastSig = sig;
      sendMove({
        id: myId,
        x: +s.x.toFixed(2),
        y: +s.y.toFixed(2),
        z: +s.z.toFixed(2),
        h: +s.h.toFixed(3),
        s: +s.speed.toFixed(2),
        l: +anim.lean.toFixed(2),
      });
    }
  });

  return (
    <>
      <directionalLight
        ref={light}
        intensity={2.2}
        castShadow
        shadow-mapSize={lowPower ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0005}
      />
      <group ref={outer}>
        <group ref={pitchG}>
          <Rider profile={profile} anim={anim} me bubble={bubble} />
        </group>
      </group>
      {profile.equip?.trail && <Trail kind={profile.equip.trail} source={outer} anim={anim} />}
    </>
  );
}

export function RemoteRider({ player, remote, bubble }: { player: NetPlayer; remote: Remote | undefined; bubble: string | null }) {
  const outer = useRef<THREE.Group>(null);
  const pitchG = useRef<THREE.Group>(null);
  const pitch = useRef(0);

  useFrame((_, dtRaw) => {
    if (!remote) return;
    const dt = Math.min(dtRaw, 0.05);
    const c = remote.cur;
    const tg = remote.target;
    const k = 1 - Math.exp(-10 * dt);
    c.x += (tg.x - c.x) * k;
    c.y += (tg.y - c.y) * k;
    c.z += (tg.z - c.z) * k;
    let dh = tg.h - c.h;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    c.h += dh * k;
    if (now() - remote.lastAt > 2.5) remote.anim.speed *= 0.95;
    remote.anim.dist += remote.anim.speed * dt;

    const g = groundHeight(c.x, c.z);
    const tp = c.y - g > 0.2 ? 0 : slopePitch(c.x, c.z, c.h);
    pitch.current += (tp - pitch.current) * Math.min(1, 10 * dt);

    if (outer.current) {
      outer.current.visible = remote.seen;
      outer.current.position.set(c.x, c.y, c.z);
      outer.current.rotation.y = c.h;
    }
    if (pitchG.current) pitchG.current.rotation.x = pitch.current;
  });

  if (!remote) return null;
  return (
    <>
      <group ref={outer} visible={false}>
        <group ref={pitchG}>
          <Rider profile={player} anim={remote.anim} label bubble={bubble} />
        </group>
      </group>
      {player.equip?.trail && <Trail kind={player.equip.trail} source={outer} anim={remote.anim} />}
    </>
  );
}

export type { Bubble };
