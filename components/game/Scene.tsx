"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getBike } from "@/lib/bikes";
import { EMOTE_DUR, TRICK_MAP, type Profile, type TrickId } from "@/lib/profile";
import { getMap, groundHeight, hoopFlash, randomStarPos, resolveCollisions } from "@/lib/maps";
import { sfx } from "@/lib/sound";
import { Rider } from "../three/Rider";
import { Trail } from "../three/Custom";
import { stars } from "../three/World";
import { CRASH_DUR, newAnim, now, type AnimState } from "../three/anim";
import { axis, input, pollGamepad, queueTrick, trickQueue } from "./input";
import { addSkid } from "../three/Skids";
import { setSkid, setWind } from "@/lib/sound";
import { buzz, controls, tiltSteer } from "@/lib/settings";
import type { Bubble, MovePayload, NetPlayer, Remote } from "./net";

import { ghost, group, race, raceResults, saveGhost } from "./state";
export { race, raceResults };

export const stats = { speed: 0, dist: 0, stars: 0, x: 0, z: 0, trickScore: 0, airborne: false, boosting: false, drafting: false };

/** 화면 가운데 띄울 알림 (묘기 점수 등) */
export const popups: { text: string; kind: "trick" | "crash" | "bonus" }[] = [];

/** 자전거별 묘기 점수 배율 */
const TRICK_MULT: Record<string, number> = {
  bmx: 1.5, mtb: 1.2, unicycle: 2, tricycle: 2, tandem: 1.8, cruiser: 1.3,
};
export const view = { mode: "chase" as "chase" | "front" | "top" };

const GRAVITY = 18;

export function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const r = sec - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}

function slopePitch(x: number, z: number, h: number) {
  const fx = Math.sin(h) * 0.5;
  const fz = Math.cos(h) * 0.5;
  const a = groundHeight(x + fx, z + fz);
  const b = groundHeight(x - fx, z - fz);
  return -Math.atan2(a - b, 1);
}


export function Player({
  profile,
  anim,
  myId,
  bubble,
  sendMove,
  sendTrick,
  lowPower,
  remotes,
}: {
  remotes?: React.RefObject<Map<string, Remote>>;
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
  const map = getMap();
  const st = useRef({
    x: map.spawn.x + (Math.random() - 0.5) * 4,
    y: groundHeight(map.spawn.x, map.spawn.z),
    z: map.spawn.z + (Math.random() - 0.5) * 3,
    h: map.spawn.heading,
    vx: 0,
    vz: 0,
    liftAt: -10,
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
    hoopAt: map.hoops.map(() => -10),
    steer: 0,
    lastTaps: 0,
    bumpAt: -10,
    yawRate: 0,
    drift: 0,
    driftStart: 0,
    skidAcc: 0,
    shake: 0,
    camRoll: 0,
  });
  const lookAt = useRef(new THREE.Vector3());
  const tmp = useRef(new THREE.Vector3()).current;

  useEffect(() => {
    // 테스트용: ?debug 로 열면 window.__teleport(x, z, heading) 사용 가능
    if (
      typeof window !== "undefined" &&
      window.location.search.includes("debug") &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      (window as unknown as Record<string, unknown>).__teleport = (x: number, z: number, h = 0) => {
        Object.assign(st.current, { x, z, h, y: groundHeight(x, z), speed: 0, vy: 0, vx: 0, vz: 0, grounded: true });
      };
      // 코스 게이트 i 로 이동 (테스트용)
      (window as unknown as Record<string, unknown>).__gate = (i: number, back = 0) => {
        const g = getMap().course.gates[i];
        const x = g.x - Math.sin(g.heading) * back;
        const z = g.z - Math.cos(g.heading) * back;
        Object.assign(st.current, { x, z, h: g.heading, y: groundHeight(x, z), speed: 0, vy: 0, vx: 0, vz: 0, grounded: true });
      };
    }
    if (light.current) scene.add(light.current.target);
    camera.position.set(st.current.x - 8, 4, st.current.z);
  }, [camera, scene]);

  const finishRace = (t: number) => {
    const sec = t - race.start;
    race.last = sec;
    const best = !race.best || sec < race.best;
    if (best) race.best = sec;
    const ms = Math.round(sec * 1000);
    raceResults.push(ms);
    // 고스트: 이 맵에서 내 역대 최고면 주행 기록 저장
    const ghostBest = !ghost.best || ms < ghost.best.ms;
    if (ghostBest && ghost.recording.length > 5) {
      saveGhost(map.id, { ms, frames: ghost.recording.slice(), bike: profile.bike, color: profile.color, hat: profile.hat });
    }
    if (group.phase === "racing") group.myFinish = ms;
    popups.push({ text: `🏁 ${fmtTime(sec)}${ghostBest ? "  👻 고스트 갱신!" : best ? "  최고 기록!" : ""}`, kind: "trick" });
    sfx("finish");
    buzz([30, 40, 30, 40, 70]);
  };
  const startRun = (t: number) => {
    race.running = true;
    race.start = t;
    race.next = 1;
    race.total = map.course.gates.length;
    ghost.recording = [];
    s_lastRec.current = -1;
  };
  const s_lastRec = useRef(-1);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const s = st.current;
    const t = now();
    // ── 다 같이 레이스: 출발선 이동, 카운트다운 동안 정지, 출발 ──
    if (group.phase === "waiting" && !group.teleported && t >= group.goAt - 6) {
      const g0 = map.course.gates[0];
      const back = 5 + Math.floor(group.slot / 2) * 3.2;
      const side = (group.slot % 2 ? 1 : -1) * 1.8;
      s.x = g0.x - Math.sin(g0.heading) * back + Math.cos(g0.heading) * side;
      s.z = g0.z - Math.cos(g0.heading) * back - Math.sin(g0.heading) * side;
      s.h = g0.heading;
      s.y = groundHeight(s.x, s.z);
      s.speed = s.vx = s.vz = s.vy = 0;
      s.grounded = true;
      race.running = false;
      race.next = 0;
      group.teleported = true;
    }
    const frozen = group.phase === "waiting" && group.teleported && t < group.goAt;
    if (frozen) {
      s.speed = s.vx = s.vz = 0;
    }
    if (group.phase === "waiting" && group.teleported && t >= group.goAt) {
      group.phase = "racing";
      startRun(group.goAt);
      sfx("finish");
    }
    const stunned = t < s.stunUntil || frozen;
    const bowing = (anim.emote === "bow" && t - anim.emoteAt < EMOTE_DUR.bow) || stunned;

    // ── 부스터 ──
    if (s.grounded) {
      for (const b of map.boosts) {
        if (Math.hypot(b.x - s.x, b.z - s.z) < 2.2 && t > s.boostUntil - 1.2) {
          s.boostUntil = t + 1.6;
          s.speed = Math.max(s.speed, spec.maxSpeed * 1.4);
          popups.push({ text: "🚀 부스터!", kind: "bonus" });
          sfx("boost");
          buzz(40);
        }
      }
    }
    const boosting = t < s.boostUntil;

    // ── 입력 (키보드 + 조이스틱/게임패드) ──
    const padPressed = pollGamepad();
    for (const b of padPressed) {
      // X(2): 묘기 (A 는 점프 버튼과 같이 처리)
      if (b === 2) queueTrick("auto");
    }
    const brakeIn = bowing ? 0 : Math.max(input.b ? 1 : 0, axis.brake);
    // 휴대폰 자동 페달: 브레이크를 누르지 않는 동안 알아서 밟음 (페달 버튼 = 힘껏)
    const autoPedal = controls.touch && controls.autoPedal && controls.armed && brakeIn === 0 && s.grounded ? 0.82 : 0;
    const throttle = bowing ? 0 : Math.max(input.f ? 1 : 0, axis.throttle, autoPedal);
    const jumpIn = input.jump || axis.jump;
    // 버튼을 누른 횟수로 판단 (짧게 톡 쳐도 놓치지 않음)
    const tapped = input.jumpTaps !== s.lastTaps;
    s.lastTaps = input.jumpTaps;
    // 공중에서 점프를 다시 누르면 묘기
    if (tapped && !s.grounded) queueTrick("auto");
    const tilt = controls.tilt ? tiltSteer() : 0;
    const analog = axis.steerActive ? axis.steer : tilt;
    const rawSteer = bowing
      ? 0
      : axis.steerActive || Math.abs(tilt) > 0.001
        ? Math.max(-1, Math.min(1, analog * controls.sensitivity))
        : (input.l ? 1 : 0) - (input.r ? 1 : 0);
    // 핸들은 부드럽게 따라옴 (놓으면 더 빨리 돌아옴)
    const steerRate = Math.abs(rawSteer) > Math.abs(s.steer) ? 9 : 12;
    s.steer += (rawSteer - s.steer) * (1 - Math.exp(-steerRate * dt));

    // ── 속도 ──
    const paved = map.paved(s.x, s.z);
    const wet = map.water(s.x, s.z) && s.y < 0.2;
    if (wet && !anim.wet) sfx("splash");
    anim.wet = wet;
    const icy = map.ice(s.x, s.z) && s.grounded;
    // 지형 경사 (진행 방향 기준, + 오르막)
    const fsx = Math.sin(s.h) * 0.6;
    const fsz = Math.cos(s.h) * 0.6;
    const slope = s.grounded ? (map.base(s.x + fsx, s.z + fsz) - map.base(s.x - fsx, s.z - fsz)) / 1.2 : 0;
    let cap = spec.maxSpeed * (paved || spec.id === "mtb" ? 1 : 0.72);
    if (boosting) cap = spec.maxSpeed * 1.6;
    cap *= 1 + Math.max(0, -slope) * 1.6; // 내리막에서는 더 빨리
    if (wet) cap = 2.5;
    // 🌬️ 슬립스트림: 달리는 사람 바로 뒤를 따라가면 공기 저항이 줄어듦
    let drafting = false;
    if (remotes?.current && s.grounded && s.speed > 4) {
      for (const r of remotes.current.values()) {
        if (!r.seen || r.anim.speed < 4) continue;
        const fx = Math.sin(r.cur.h);
        const fz = Math.cos(r.cur.h);
        const dx = s.x - r.cur.x;
        const dz = s.z - r.cur.z;
        const behind = -(dx * fx + dz * fz);
        const lateral = Math.abs(dx * fz - dz * fx);
        const aligned = Math.cos(s.h - r.cur.h) > 0.8;
        if (behind > 1.2 && behind < 9 && lateral < 1.4 && aligned && Math.abs(s.y - r.cur.y) < 1.5) {
          drafting = true;
          break;
        }
      }
    }
    stats.drafting = drafting;
    if (drafting) cap *= 1.14;
    const v = Math.abs(s.speed);
    if (s.grounded && !stunned) s.speed -= 9 * slope * dt;

    // 드리프트: 달리면서 브레이크 + 방향
    const drifting = s.grounded && !icy && !wet && brakeIn > 0.5 && Math.abs(s.steer) > 0.45 && s.speed > 6;
    if (drifting && s.drift === 0) s.driftStart = t;
    s.drift = drifting ? Math.min(1, s.drift + dt * 4) : Math.max(0, s.drift - dt * 3);

    if (s.grounded) {
      // 페달: 출발할 때 힘차고 최고속도에 가까울수록 약해짐
      if (throttle > 0 && s.speed < cap) {
        const r = Math.max(0, s.speed) / cap;
        const torque = spec.accel * (1.35 - r * r) * (boosting ? 1.8 : 1);
        s.speed += torque * throttle * dt;
      }
      if (brakeIn > 0) {
        if (drifting) s.speed -= 3.5 * dt;
        else if (s.speed > 0.2) s.speed -= (icy ? 2.5 : 13) * brakeIn * dt;
        else s.speed -= spec.accel * 0.45 * brakeIn * dt; // 후진
      }
      // 구름 저항 + 공기 저항 (관성으로 부드럽게 굴러감)
      const roll = icy ? 0.08 : paved ? 0.35 : 0.9;
      const drag = roll + (drafting ? 0.0015 : 0.0045) * v * v;
      if (s.speed > 0) s.speed = Math.max(throttle > 0 || brakeIn > 0 ? -99 : 0, s.speed - drag * dt);
      else if (s.speed < 0) s.speed = Math.min(0, s.speed + (drag + 1) * dt);
    } else {
      s.speed -= 0.004 * v * v * Math.sign(s.speed) * dt;
    }
    if (bowing) s.speed *= Math.max(0, 1 - 5 * dt);
    if (s.speed > cap) s.speed += (cap - s.speed) * Math.min(1, (throttle > 0 ? 2 : 1.2) * dt);
    s.speed = Math.max(-spec.maxSpeed * 0.3, s.speed);

    // ── 방향: 속도가 빠를수록 크게 돈다 ──
    const vn = Math.abs(s.speed);
    const low = Math.min(1, vn / 2.2); // 멈춰있으면 못 돔
    const hi = 1 / (1 + Math.max(0, vn - 4) / (spec.maxSpeed * 0.9));
    let yaw = s.steer * spec.turn * 1.25 * low * hi * (s.speed < 0 ? -1 : 1);
    if (!s.grounded) yaw *= 0.55;
    if (s.drift > 0) yaw *= 1 + s.drift * 0.7;
    s.yawRate = yaw;
    s.h += yaw * dt;

    // 페달·자세 애니메이션
    const pedaling = throttle > 0 && s.grounded;
    const crankSpeed = Math.max(vn, pedaling ? 2.5 : 0) / spec.wheel / spec.gear;
    if (pedaling || spec.id === "fixie" || spec.id === "unicycle" || spec.id === "tricycle") anim.crank += crankSpeed * dt * (s.speed < 0 ? -1 : 1);
    const wantSprint = pedaling && s.speed < cap * 0.55 && spec.id !== "unicycle" ? 1 : 0;
    anim.sprint += (wantSprint - anim.sprint) * Math.min(1, 5 * dt);
    anim.brake += ((brakeIn > 0 && s.speed > 1 && s.grounded ? 1 : 0) - anim.brake) * Math.min(1, 8 * dt);

    // ── 이동 + 충돌 ──
    const px = s.x;
    const pz = s.z;
    // 얼음 위에서는 속도 방향이 천천히 따라옴 (미끄러짐)
    const wantVx = Math.sin(s.h) * s.speed;
    const wantVz = Math.cos(s.h) * s.speed;
    const grip = icy ? 1 - Math.exp(-0.8 * dt) : s.drift > 0 ? 1 - Math.exp(-(9 - s.drift * 7) * dt) : 1;
    s.vx += (wantVx - s.vx) * grip;
    s.vz += (wantVz - s.vz) * grip;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    const g0 = groundHeight(s.x, s.z);
    if (s.grounded && g0 - s.y > 0.45) {
      // 점프대 옆면에 부딪힘
      s.x = px;
      s.z = pz;
      s.speed *= -0.3;
    }
    const moveWant = Math.hypot(s.x - px, s.z - pz);
    resolveCollisions(s, 0.55);
    // 💥 다른 라이더와 부딪힘: 서로 밀려남
    if (remotes?.current) {
      for (const r of remotes.current.values()) {
        if (!r.seen) continue;
        const dx = s.x - r.cur.x;
        const dz = s.z - r.cur.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.1 && d > 0.001 && Math.abs(s.y - r.cur.y) < 1.2) {
          const push = (1.1 - d) / d;
          s.x += dx * push;
          s.z += dz * push;
          const rel = Math.hypot(s.vx - Math.sin(r.cur.h) * r.anim.speed, s.vz - Math.cos(r.cur.h) * r.anim.speed);
          if (rel > 4 && t - s.bumpAt > 0.6) {
            s.bumpAt = t;
            s.speed *= 0.75;
            s.shake = Math.max(s.shake, Math.min(0.3, rel * 0.03));
            anim.squash = Math.max(anim.squash, 0.4);
            sfx("land");
            buzz(35);
            popups.push({ text: "💥 쿵!", kind: "crash" });
          }
        }
      }
    }
    const got = Math.hypot(s.x - px, s.z - pz);
    if (moveWant > 0.0001 && got < moveWant * 0.6) s.speed *= 0.92;

    // ── 높이 / 점프 ──
    const g = groundHeight(s.x, s.z);
    if (s.grounded) {
      if ((jumpIn || tapped) && !bowing) {
        s.vy = spec.jump;
        s.grounded = false;
        s.airStart = t;
        sfx("jump", 0.7);
        buzz(8);
      } else if (g < s.y - (0.08 + 0.9 * Math.abs(s.speed) * dt)) {
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
        const impact = Math.min(1, Math.max(0, -s.vy - 3) / 12);
        anim.squash = Math.max(anim.squash, impact);
        s.shake = Math.max(s.shake, impact * 0.35);
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
        if (!crashed && t - s.airStart > 0.35) {
          sfx("land", 0.8);
          buzz(Math.round(15 + impact * 40));
        }
        if (crashed) {
          sfx("crash");
          buzz([60, 40, 90]);
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
          sfx("trick");
          buzz([25, 30, 25]);
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
    if (want && !s.grounded && !stunned && !anim.trick && (s.y - g > 0.15 || s.vy < 0)) {
      trickQueue.id = null;
      let pick: TrickId | null = want === "auto" ? null : want;
      if (want === "auto") {
        // 착지까지 남은 시간
        const h = Math.max(0, s.y - g);
        const tLand = (s.vy + Math.sqrt(Math.max(0, s.vy * s.vy + 2 * GRAVITY * h))) / GRAVITY;
        const order: TrickId[] =
          brakeIn > 0 ? ["frontflip", "backflip", "superman", "spin", "nohand"]
          : Math.abs(rawSteer) > 0.3 ? ["spin", "backflip", "frontflip", "superman", "nohand"]
          : ["frontflip", "backflip", "superman", "spin", "nohand"];
        const fits = order.filter((id) => TRICK_MAP[id].dur * 0.86 <= tLand);
        pick = fits.find((id) => !s.combo.includes(id)) ?? fits[0] ?? null;
        if (!pick) popups.push({ text: "더 높이 날아야 묘기를 할 수 있어요!", kind: "bonus" });
      }
      if (pick) {
        anim.trick = pick;
        anim.trickAt = t;
        sendTrick(pick);
      }
    } else if (want && t - trickQueue.at > 0.4) {
      trickQueue.id = null;
    }
    if (anim.trick) {
      const p = (t - anim.trickAt) / TRICK_MAP[anim.trick].dur;
      if (p >= 1) {
        s.combo.push(anim.trick);
        anim.trick = null;
      }
    }

    // ── 공중 링 통과 ──
    for (let i = 0; i < map.hoops.length; i++) {
      const h = map.hoops[i];
      if (t - s.hoopAt[i] < 3) continue;
      if (Math.hypot(h.x - s.x, h.y - (s.y + 0.9), h.z - s.z) < h.r + 0.3) {
        s.hoopAt[i] = t;
        hoopFlash[i] = t;
        stats.stars += 3;
        stats.trickScore += 250;
        popups.push({ text: "💫 링 통과! ⭐+3 +250", kind: "bonus" });
        sfx("ring");
        buzz([15, 20, 15]);
      }
    }
    stats.airborne = !s.grounded;
    stats.boosting = boosting;

    // ── 애니메이션 상태 ──
    anim.speed = s.speed;
    anim.dist += s.speed * dt;
    // 실제 자전거처럼 원심력만큼 안쪽으로 기울기
    const leanT = Math.max(-0.62, Math.min(0.62, Math.atan((vn * s.yawRate) / 9.8)));
    anim.lean += (leanT * (s.grounded ? 1 : 0.4) - anim.lean) * Math.min(1, 8 * dt);
    anim.squash = Math.max(0, anim.squash - dt * 3);
    // 드리프트 시 차체가 바깥쪽으로 틀어짐
    const vAng = Math.atan2(s.vx, s.vz);
    let slip = s.h - vAng;
    slip = Math.atan2(Math.sin(slip), Math.cos(slip));
    anim.slip = vn > 1 ? Math.max(-0.6, Math.min(0.6, -slip)) * (s.drift > 0 ? 1 : 0.4) : 0;

    // 스키드 자국 + 소리
    const skidding = s.grounded && vn > 3 && (s.drift > 0.3 || (anim.brake > 0.6 && vn > 6) || (icy && Math.abs(slip) > 0.25));
    if (skidding) {
      s.skidAcc += vn * dt;
      while (s.skidAcc > 0.3) {
        s.skidAcc -= 0.3;
        const rx = s.x - Math.sin(s.h) * spec.base * 0.5;
        const rz = s.z - Math.cos(s.h) * spec.base * 0.5;
        addSkid(rx, groundHeight(rx, rz), rz, s.h, s.drift > 0.3 ? 0.16 : 0.1);
      }
    }
    setSkid(skidding ? Math.min(1, vn / 12) : 0);
    setWind((vn - 6) / (spec.maxSpeed * 1.2));
    // 드리프트 점수
    if (!drifting && s.drift > 0 && s.driftStart > 0) {
      const dur = t - s.driftStart;
      if (dur > 0.7) {
        const pts = Math.round(dur * 180);
        stats.trickScore += pts;
        popups.push({ text: `🌀 드리프트 ${dur.toFixed(1)}초 +${pts}`, kind: "trick" });
      }
      s.driftStart = 0;
    }
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
      if (Math.hypot(star.x - s.x, star.z - s.z) < 1.7 && s.y - groundHeight(star.x, star.z) < 3) {
        stats.stars += 1;
        sfx("star");
        const [nx, nz] = randomStarPos();
        star.x = nx;
        star.z = nz;
      }
    }

    // ── 리프트 ──
    const lift = map.lift;
    if (lift && s.grounded && t - s.liftAt > 3 && Math.hypot(lift.x - s.x, lift.z - s.z) < lift.r) {
      s.liftAt = t;
      s.x = lift.to.x;
      s.z = lift.to.z;
      s.h = lift.to.heading;
      s.y = groundHeight(s.x, s.z);
      s.speed = 0;
      s.vx = 0;
      s.vz = 0;
      popups.push({ text: "🚡 정상 도착! 슬라럼 출발 게이트로 내려가요", kind: "bonus" });
      sfx("lift");
    }

    // ── 타임어택 ──
    const course = map.course;
    const gate = course.gates[race.next];
    if (gate && Math.hypot(gate.x - s.x, gate.z - s.z) < gate.w / 2 + 0.5) {
      const n = course.gates.length;
      if (race.next === 0 && group.phase !== "waiting") {
        if (race.running && course.kind === "lap") {
          finishRace(t);
        }
        if (group.phase === "racing" && group.myFinish !== null) {
          // 다 같이 레이스는 한 바퀴로 끝
          race.running = false;
          race.next = -1;
        } else {
          startRun(t);
        }
        if (race.running && (course.kind === "run" || !race.last)) popups.push({ text: `⏱️ ${course.name} 시작!`, kind: "bonus" });
        void n;
        sfx("checkpoint");
        buzz(12);
      } else if (race.running) {
        race.next += 1;
        if (race.next >= n) {
          if (course.kind === "run") {
            finishRace(t);
            race.running = false;
            race.next = group.phase === "racing" ? -1 : 0;
          } else {
            race.next = 0; // 출발선으로 돌아가면 완주
          }
        } else {
          sfx("checkpoint");
        buzz(12);
        }
      }
    }
    // 슬라럼: 게이트를 지나쳐 버리면 +2초 벌칙 후 다음 게이트로
    const g2 = course.gates[race.next];
    if (course.kind === "run" && race.running && g2 && race.next > 0) {
      const ahead = (s.x - g2.x) * Math.sin(g2.heading) + (s.z - g2.z) * Math.cos(g2.heading);
      if (ahead > 2 && Math.hypot(s.x - g2.x, s.z - g2.z) < 25) {
        race.start -= 2;
        race.next += 1;
        popups.push({ text: "🚩 게이트 놓침! +2초", kind: "crash" });
        if (race.next >= course.gates.length) {
          finishRace(t);
          race.running = false;
          race.next = 0;
        }
      }
    }
    if (race.running && t - s_lastRec.current > 0.1) {
      s_lastRec.current = t;
      ghost.recording.push({ t: +(t - race.start).toFixed(2), x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), h: +s.h.toFixed(3) });
      if (ghost.recording.length > 6000) ghost.recording.length = 0;
    }
    if (race.running && t - race.start > 600) {
      race.running = false;
      race.next = 0;
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
      const portrait = (camera as THREE.PerspectiveCamera).aspect < 1;
      const back = 5.6 + vn * 0.1 + (portrait ? 1.2 : 0);
      // 코너에서는 도는 쪽을 미리 바라봄
      const look = s.h + s.yawRate * 0.35;
      cx = s.x - Math.sin(s.h - s.yawRate * 0.12) * back;
      cz = s.z - Math.cos(s.h - s.yawRate * 0.12) * back;
      cy = s.y + 2.5 + vn * 0.03;
      tmp.set(s.x + Math.sin(look) * 3, s.y + 1.1, s.z + Math.cos(look) * 3);
    }
    const cam = camera as THREE.PerspectiveCamera;
    // 세로 화면은 좌우가 좁으므로 시야를 넓힘
    const baseFov = cam.aspect < 1 ? 70 : 56;
    const fov = Math.min(baseFov + 28, baseFov + vn * 0.85 + (boosting ? 8 : 0));
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
    // 기울기 따라 살짝 롤 + 착지 흔들림
    s.camRoll += ((mode === "chase" ? -anim.lean * 0.25 : 0) - s.camRoll) * Math.min(1, 5 * dt);
    camera.rotateZ(s.camRoll);
    if (s.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * s.shake;
      camera.position.y += (Math.random() - 0.5) * s.shake;
      s.shake *= Math.exp(-8 * dt);
    }

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
        sp: +anim.sprint.toFixed(2),
        bk: +anim.brake.toFixed(2),
        sl: +anim.slip.toFixed(2),
        pd: throttle > 0 ? 1 : 0,
      });
    }
  });

  return (
    <>
      <directionalLight
        ref={light}
        intensity={map.sky.sun}
        color={map.sky.sunColor}
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

export function RemoteRider({
  player,
  remote,
  bubble,
  onSelect,
}: {
  player: NetPlayer;
  remote: Remote | undefined;
  bubble: string | null;
  onSelect?: (id: string) => void;
}) {
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
    const rs = getBike(player.bike);
    if (remote.pedaling || rs.id === "fixie" || rs.id === "unicycle" || rs.id === "tricycle") {
      remote.anim.crank += (Math.max(Math.abs(remote.anim.speed), remote.pedaling ? 2.5 : 0) / rs.wheel / rs.gear) * dt * (remote.anim.speed < 0 ? -1 : 1);
    }

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
      <group
        ref={outer}
        visible={false}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(player.id);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {/* 누르기 쉬운 투명 영역 */}
        <mesh position={[0, 1, 0]} visible={false}>
          <boxGeometry args={[1.4, 2.2, 2]} />
          <meshBasicMaterial />
        </mesh>
        <group ref={pitchG}>
          <Rider profile={player} anim={remote.anim} label bubble={bubble} />
        </group>
      </group>
      {player.equip?.trail && <Trail kind={player.equip.trail} source={outer} anim={remote.anim} />}
    </>
  );
}

export type { Bubble };

/** 👻 내 최고 기록 주행을 반투명하게 재생 */
export function GhostRider() {
  const outer = useRef<THREE.Group>(null);
  const anim = useRef(newAnim()).current;
  const best = ghost.best;
  const profile = useMemo<Profile | null>(
    () => (best ? { nickname: `👻 ${fmtTime(best.ms / 1000)}`, color: best.color, hat: best.hat as Profile["hat"], bike: best.bike as Profile["bike"] } : null),
    [best],
  );
  const idx = useRef(0);
  const prev = useRef({ x: 0, z: 0 });

  useEffect(() => {
    // 모든 재질을 반투명하게
    const g = outer.current;
    if (!g) return;
    const id = setInterval(() => {
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) {
          if (!mm.userData.ghost) {
            mm.userData.ghost = true;
            mm.transparent = true;
            mm.opacity = 0.38;
            mm.depthWrite = false;
          }
        }
        (o as THREE.Mesh).castShadow = false;
      });
    }, 500);
    return () => clearInterval(id);
  }, [profile]);

  useFrame((_, dtRaw) => {
    const g = outer.current;
    if (!g) return;
    const b = ghost.best;
    if (!b || !race.running || b.frames.length < 2) {
      g.visible = false;
      idx.current = 0;
      return;
    }
    const tt = now() - race.start;
    const f = b.frames;
    if (idx.current >= f.length - 1 || f[idx.current].t > tt) idx.current = 0;
    while (idx.current < f.length - 2 && f[idx.current + 1].t < tt) idx.current++;
    const a = f[idx.current];
    const c = f[idx.current + 1];
    if (tt > f[f.length - 1].t) {
      g.visible = false;
      return;
    }
    const k = Math.max(0, Math.min(1, (tt - a.t) / Math.max(0.001, c.t - a.t)));
    const x = a.x + (c.x - a.x) * k;
    const z = a.z + (c.z - a.z) * k;
    let dh = c.h - a.h;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    g.visible = true;
    g.position.set(x, a.y + (c.y - a.y) * k, z);
    g.rotation.y = a.h + dh * k;
    const dt = Math.max(0.001, Math.min(dtRaw, 0.05));
    const sp = Math.hypot(x - prev.current.x, z - prev.current.z) / dt;
    prev.current = { x, z };
    anim.speed = Math.min(40, sp);
    anim.dist += anim.speed * dt;
    const spec = getBike(b.bike);
    anim.crank += (anim.speed / spec.wheel / spec.gear) * dt;
  });

  if (!profile) return null;
  return (
    <group ref={outer} visible={false}>
      <Rider profile={profile} anim={anim} label />
    </group>
  );
}
