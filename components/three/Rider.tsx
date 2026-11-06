"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getBike } from "@/lib/bikes";
import type { Profile } from "@/lib/profile";
import { Bike } from "./Bike";
import { Character } from "./Character";
import type { AnimState } from "./anim";
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

  useFrame(() => {
    if (leanRef.current) {
      // 외발/세발은 덜 기울임
      const k = spec.id === "tricycle" ? 0.2 : 1;
      leanRef.current.rotation.z += (-anim.lean * k - leanRef.current.rotation.z) * 0.15;
    }
  });

  return (
    <group>
      <group ref={leanRef}>
        <Bike spec={spec} anim={anim} />
        <Character spec={spec} profile={profile} anim={anim} />
      </group>
      {(label || bubble !== undefined) && (
        <Label y={2.25} name={label ? `${spec.emoji} ${profile.nickname}` : undefined} bubble={bubble} me={me} />
      )}
    </group>
  );
}
