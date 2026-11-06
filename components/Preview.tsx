"use client";

import { useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Profile } from "@/lib/profile";
import { Rider } from "./three/Rider";
import type { AnimState } from "./three/anim";

function Pedaler({ anim }: { anim: AnimState }) {
  useFrame((_, dt) => {
    anim.speed = 2.5;
    anim.dist += anim.speed * Math.min(dt, 0.05);
  });
  return null;
}

export default function Preview({ profile, anim }: { profile: Profile; anim: AnimState }) {
  const key = useMemo(() => `${profile.bike}-${profile.hat}-${profile.color}`, [profile]);
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [2.6, 1.9, 3.2], fov: 40 }}>
      <color attach="background" args={["#fff4e6"]} />
      <hemisphereLight args={["#ffffff", "#ffd6a5", 1.2]} />
      <directionalLight position={[3, 6, 4]} intensity={2} castShadow shadow-mapSize={[1024, 1024]} />
      <Pedaler anim={anim} />
      <group position={[0, -0.9, 0]}>
        <Rider key={key} profile={profile} anim={anim} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
          <circleGeometry args={[1.9, 48]} />
          <meshStandardMaterial color="#ffe8cc" />
        </mesh>
        <ContactShadows opacity={0.35} scale={5} blur={2.4} far={2} />
      </group>
      <OrbitControls
        target={[0, 0.1, 0]}
        enablePan={false}
        minDistance={2.5}
        maxDistance={7}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}
