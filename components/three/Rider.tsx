"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBike } from "@/lib/bikes";
import type { Profile } from "@/lib/profile";
import { Bike } from "./Bike";
import { Character } from "./Character";
import { CRASH_DUR, now, type AnimState } from "./anim";
import { TRICK_MAP } from "@/lib/profile";
import { Label } from "./Label";

/** 자전거 + 캐릭터 + 이름표/말풍선 */
export function Rider({
  profile,
  anim,
  label,
  bubble,
  me,
}: {
  profile: Profile;
  anim: AnimState;
  label?: boolean;
  bubble?: string | null;
  me?: boolean;
}) {
  const spec = getBike(profile.bike);
  const leanRef = useRef<THREE.Group>(null);
  const trickRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const tg = trickRef.current;
    if (tg) {
      const t = now();
      let rx = 0, ry = 0, rz = 0;
      if (anim.trick) {
        const p = (t - anim.trickAt) / TRICK_MAP[anim.trick].dur;
        if (p >= 0 && p < 1) {
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          if (anim.trick === "backflip") rx = -Math.PI * 2 * e;
          else if (anim.trick === "frontflip") rx = Math.PI * 2 * e;
          else if (anim.trick === "spin") ry = Math.PI * 2 * e;
          else if (anim.trick === "superman") rx = -Math.sin(p * Math.PI) * 0.25;
        }
      }
      const ct = t - anim.crashAt;
      if (ct >= 0 && ct < CRASH_DUR) {
        const fall = Math.min(1, ct / 0.25) * Math.min(1, (CRASH_DUR - ct) / 0.35);
        rz = 1.35 * fall;
        rx += Math.sin(ct * 25) * 0.05 * fall;
      }
      tg.rotation.set(rx, ry, rz);
    }
    if (leanRef.current) {
      // 외발/세발은 덜 기울임
      const k = spec.id === "tricycle" ? 0.2 : 1;
      leanRef.current.rotation.z += (-anim.lean * k - leanRef.current.rotation.z) * 0.15;
    }
  });

  return (
    <group>
      <group ref={trickRef} position={[0, 0.85, 0]}>
        <group position={[0, -0.85, 0]}>
          <group ref={leanRef}>
            <Bike spec={spec} anim={anim} equip={profile.equip} />
            <Character spec={spec} profile={profile} anim={anim} />
          </group>
        </group>
      </group>
      {(label || bubble !== undefined) && (
        <Label y={2.25} name={label ? `${spec.emoji} ${profile.nickname}` : undefined} bubble={bubble} me={me} />
      )}
    </group>
  );
}
