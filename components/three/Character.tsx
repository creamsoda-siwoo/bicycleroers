"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BikeSpec } from "@/lib/bikes";
import { EMOTE_DUR, TRICK_MAP, type HatId, type Profile } from "@/lib/profile";
import { placeLimb } from "./Tube";
import { Wings } from "./Custom";
import { crankAngle, crankLength } from "./Bike";
import { CRASH_DUR, now, type AnimState } from "./anim";

const SKIN = "#ffe3c8";
const PANTS = "#3d405b";
const SHOES = "#2b2d42";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function gripX(spec: BikeSpec) {
  switch (spec.id) {
    case "road": return 0.21;
    case "cruiser": return 0.33;
    case "bmx":
    case "tricycle": return 0.29;
    case "mtb": return 0.28;
    default: return 0.22;
  }
}

function gripOffset(spec: BikeSpec): [number, number] {
  // [dy, dz]
  if (spec.id === "road") return [0.0, 0.1];
  if (spec.id === "cruiser") return [0.04, -0.2];
  return [0, 0];
}

function Hat({ hat, color }: { hat: HatId; color: string }) {
  switch (hat) {
    case "helmet":
      return (
        <group position={[0, 0.04, -0.01]}>
          <mesh castShadow>
            <sphereGeometry args={[0.33, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.02, 0]} scale={[0.4, 1, 1.02]}>
            <sphereGeometry args={[0.335, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.05, 0.3]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.3, 0.02, 0.1]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      );
    case "cap":
      return (
        <group position={[0, 0.06, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.315, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.0, 0.3]} scale={[1, 1, 0.7]}>
            <cylinderGeometry args={[0.2, 0.2, 0.02, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.31, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        </group>
      );
    case "bunny":
      return (
        <group>
          {[-1, 1].map((s) => (
            <group key={s} position={[0.12 * s, 0.36, -0.02]} rotation={[0, 0, -0.2 * s]}>
              <mesh castShadow scale={[0.33, 1, 0.22]}>
                <sphereGeometry args={[0.2, 14, 12]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0, 0, 0.03]} scale={[0.18, 0.8, 0.1]}>
                <sphereGeometry args={[0.2, 12, 10]} />
                <meshStandardMaterial color="#ffb3c6" />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "beanie":
      return (
        <group position={[0, 0.05, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.31, 0.04, 8, 30]} />
            <meshStandardMaterial color="#ffffff" roughness={1} />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={1} />
          </mesh>
        </group>
      );
    case "crown":
      return (
        <group position={[0, 0.26, 0]}>
          <mesh>
            <cylinderGeometry args={[0.17, 0.15, 0.1, 20, 1, true]} />
            <meshStandardMaterial color="#ffd60a" metalness={0.8} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.16, 0.09, Math.cos(a) * 0.16]}>
                <coneGeometry args={[0.035, 0.09, 6]} />
                <meshStandardMaterial color="#ffd60a" metalness={0.8} roughness={0.2} />
              </mesh>
            );
          })}
          <mesh position={[0, 0, 0.165]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#e63946" />
          </mesh>
        </group>
      );
    default:
      return (
        <mesh position={[0, 0.27, -0.05]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[0.06, 0.12, 8]} />
          <meshStandardMaterial color="#5c3d2e" />
        </mesh>
      );
  }
}

function Head({ profile }: { profile: Profile }) {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.3, 32, 24]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* 머리카락 (뒤통수) */}
      <mesh position={[0, 0.03, -0.03]} scale={[1.03, 1.0, 1.0]}>
        <sphereGeometry args={[0.3, 24, 16, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color="#4a3428" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0.1 * s, 0.03, 0.265]} scale={[1, 1.25, 0.6]}>
            <sphereGeometry args={[0.04, 12, 10]} />
            <meshStandardMaterial color="#1b1b1b" />
          </mesh>
          <mesh position={[0.1 * s + 0.012, 0.05, 0.29]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0.17 * s, -0.06, 0.225]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.05, 12, 10]} />
            <meshStandardMaterial color="#ff8fab" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.055, 0.285]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.035, 0.009, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#6b2d2d" />
      </mesh>
      <Hat hat={profile.hat} color={profile.color} />
    </group>
  );
}

const V = () => new THREE.Vector3();

/** 귀여운 2등신 캐릭터. 좌표는 자전거 로컬 기준. */
export function Character({ spec, profile, anim }: { spec: BikeSpec; profile: Profile; anim: AnimState }) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  const handL = useRef<THREE.Mesh>(null);
  const handR = useRef<THREE.Mesh>(null);
  const footL = useRef<THREE.Mesh>(null);
  const footR = useRef<THREE.Mesh>(null);

  const v = useRef({
    hip: V(), hipL: V(), hipR: V(), shL: V(), shR: V(),
    hL: V(), hR: V(), fL: V(), fR: V(), tmp: V(), tmp2: V(),
  }).current;

  useFrame(({ clock }) => {
    const t = now();
    const time = clock.getElapsedTime();
    const emote = anim.emote;
    const et = t - anim.emoteAt;
    const dur = emote ? EMOTE_DUR[emote] : 0;
    const active = emote !== null && et >= 0 && et < dur;
    const env = active ? smooth(et / 0.45) * smooth((dur - et) / 0.45) : 0;
    const bowW = active && emote === "bow" ? env : 0;

    // 묘기 자세
    let noHandW = 0;
    let supermanW = 0;
    if (anim.trick) {
      const td = TRICK_MAP[anim.trick].dur;
      const tp = t - anim.trickAt;
      if (tp >= 0 && tp < td) {
        const w = smooth(tp / (td * 0.2)) * smooth((td - tp) / (td * 0.2));
        if (anim.trick === "nohand") noHandW = w;
        if (anim.trick === "superman") supermanW = w;
      }
    }
    const crashT = t - anim.crashAt;
    const crashW = crashT >= 0 && crashT < CRASH_DUR ? smooth(crashT / 0.2) * smooth((CRASH_DUR - crashT) / 0.3) : 0;

    // ── 라이딩 자세 ──
    const seatY = spec.seat[0];
    const seatZ = spec.seat[1];
    let pitch = 0;
    if (spec.bar) {
      const dy = spec.bar[0] - seatY;
      const dz = spec.bar[1] - seatZ;
      pitch = Math.min(0.6, Math.max(0, Math.atan2(dz, dy + 0.25) * 0.45));
    }
    const bob = Math.sin(time * 2.2) * 0.008 + Math.abs(Math.sin(crankAngle(spec, anim.dist))) * 0.01 * Math.min(1, anim.speed / 3);
    v.hip.set(0, seatY + 0.09 + bob, seatZ - 0.02);

    // 페달 위치
    const L = crankLength(spec);
    const ca = crankAngle(spec, anim.dist);
    const bb = spec.bb;
    v.fR.set(0.13, bb[0] + L * Math.cos(ca), bb[1] + L * Math.sin(ca));
    v.fL.set(-0.13, bb[0] - L * Math.cos(ca), bb[1] - L * Math.sin(ca));

    // ── 슈퍼맨: 몸을 뒤로 쭉 뻗기 ──
    if (supermanW > 0) {
      v.tmp.set(0, v.hip.y + 0.32, v.hip.z - 0.45);
      v.hip.lerp(v.tmp, supermanW);
      v.tmp.set(0.12, v.hip.y + 0.05, v.hip.z - 0.65);
      v.fR.lerp(v.tmp, supermanW);
      v.tmp.set(-0.12, v.hip.y + 0.05, v.hip.z - 0.65);
      v.fL.lerp(v.tmp, supermanW);
      pitch = pitch + (1.35 - pitch) * supermanW;
    }

    // ── 큰절 자세 ──
    let bowPitch = 0.15;
    if (bowW > 0) {
      const X = 0.85;
      const depth = smooth((et - 0.5) / 0.7) * smooth((dur - 0.7 - et) / 0.7);
      bowPitch = 0.15 + 1.15 * depth;
      v.tmp.set(X, 0.36, 0);
      v.hip.lerp(v.tmp, bowW);
      v.fR.lerp(v.tmp.set(X + 0.13, 0.07, -0.38), bowW);
      v.fL.lerp(v.tmp.set(X - 0.13, 0.07, -0.38), bowW);
      pitch = pitch + (bowPitch - pitch) * bowW;
    }

    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    v.shL.set(v.hip.x - 0.17, v.hip.y + 0.36 * cp, v.hip.z + 0.36 * sp);
    v.shR.set(v.hip.x + 0.17, v.hip.y + 0.36 * cp, v.hip.z + 0.36 * sp);
    v.hipL.set(v.hip.x - 0.09, v.hip.y, v.hip.z);
    v.hipR.set(v.hip.x + 0.09, v.hip.y, v.hip.z);

    // 손: 핸들
    if (spec.bar) {
      const gx = gripX(spec);
      const [gy, gz] = gripOffset(spec);
      v.hR.set(gx, spec.bar[0] + gy, spec.bar[1] + gz);
      v.hL.set(-gx, spec.bar[0] + gy, spec.bar[1] + gz);
    } else {
      const wob = Math.sin(time * 3) * 0.06;
      v.hR.set(v.shR.x + 0.36, v.shR.y - 0.05 + wob, v.shR.z + 0.05);
      v.hL.set(v.shL.x - 0.36, v.shL.y - 0.05 - wob, v.shL.z + 0.05);
    }

    if (bowW > 0) {
      const depth = clamp01((bowPitch - 0.15) / 1.15);
      const X = 0.85;
      v.tmp.set(X + 0.16, 0.32, 0.14).lerp(v.tmp2.set(X + 0.15, 0.05, 0.5), depth);
      v.hR.lerp(v.tmp, bowW);
      v.tmp.set(X - 0.16, 0.32, 0.14).lerp(v.tmp2.set(X - 0.15, 0.05, 0.5), depth);
      v.hL.lerp(v.tmp, bowW);
    } else if (active && emote === "wave") {
      v.tmp.set(v.shR.x + 0.2 + Math.sin(et * 14) * 0.1, v.shR.y + 0.42, v.shR.z + 0.05);
      v.hR.lerp(v.tmp, env);
    } else if (noHandW > 0 || crashW > 0) {
      const w = Math.max(noHandW, crashW);
      const j = Math.sin(time * 12) * 0.06 * crashW;
      v.hR.lerp(v.tmp.set(v.shR.x + 0.16, v.shR.y + 0.45 + j, v.shR.z), w);
      v.hL.lerp(v.tmp.set(v.shL.x - 0.16, v.shL.y + 0.45 - j, v.shL.z), w);
    } else if (active && emote === "cheer") {
      const j = Math.abs(Math.sin(et * 9)) * 0.08;
      v.hR.lerp(v.tmp.set(v.shR.x + 0.14, v.shR.y + 0.48 + j, v.shR.z), env);
      v.hL.lerp(v.tmp.set(v.shL.x - 0.14, v.shL.y + 0.48 + j, v.shL.z), env);
    }

    if (torso.current) {
      torso.current.position.copy(v.hip);
      torso.current.rotation.x = pitch;
    }
    if (head.current) {
      // 머리는 숙인 정도를 조금 덜 따라가고 살짝 흔들림
      head.current.rotation.x = -pitch * 0.35 + (bowW > 0 ? 0.3 * bowW : 0);
      head.current.rotation.z = Math.sin(time * 1.7) * 0.04 + (active && emote === "cheer" ? Math.sin(et * 9) * 0.12 : 0);
    }

    placeLimb(legL.current, v.hipL, v.fL);
    placeLimb(legR.current, v.hipR, v.fR);
    placeLimb(armL.current, v.shL, v.hL);
    placeLimb(armR.current, v.shR, v.hR);
    footL.current?.position.copy(v.fL);
    footR.current?.position.copy(v.fR);
    handL.current?.position.copy(v.hL);
    handR.current?.position.copy(v.hR);
  });

  return (
    <group>
      <group ref={torso}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <capsuleGeometry args={[0.17, 0.16, 8, 16]} />
          <meshStandardMaterial color={profile.color} roughness={0.6} />
        </mesh>
        {/* 배꼽 단추 장식 */}
        <mesh position={[0, 0.22, 0.165]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh castShadow position={[0, 0.02, 0]} scale={[1, 0.6, 1]}>
          <sphereGeometry args={[0.17, 16, 12]} />
          <meshStandardMaterial color={PANTS} />
        </mesh>
        {profile.equip?.acc === "acc_wings" && <Wings anim={anim} />}
        <group ref={head} position={[0, 0.66, 0.02]}>
          <Head profile={profile} />
        </group>
      </group>

      <mesh ref={legL} castShadow>
        <cylinderGeometry args={[0.06, 0.055, 1, 10]} />
        <meshStandardMaterial color={PANTS} />
      </mesh>
      <mesh ref={legR} castShadow>
        <cylinderGeometry args={[0.06, 0.055, 1, 10]} />
        <meshStandardMaterial color={PANTS} />
      </mesh>
      <mesh ref={armL} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 1, 10]} />
        <meshStandardMaterial color={profile.color} />
      </mesh>
      <mesh ref={armR} castShadow>
        <cylinderGeometry args={[0.05, 0.045, 1, 10]} />
        <meshStandardMaterial color={profile.color} />
      </mesh>
      <mesh ref={handL} castShadow>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh ref={handR} castShadow>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh ref={footL} castShadow scale={[1, 0.75, 1.4]}>
        <sphereGeometry args={[0.065, 12, 10]} />
        <meshStandardMaterial color={SHOES} />
      </mesh>
      <mesh ref={footR} castShadow scale={[1, 0.75, 1.4]}>
        <sphereGeometry args={[0.065, 12, 10]} />
        <meshStandardMaterial color={SHOES} />
      </mesh>
    </group>
  );
}
