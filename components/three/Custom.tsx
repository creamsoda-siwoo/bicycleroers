"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ShopItem } from "@/lib/shop";
import type { AnimState } from "./anim";

type V3 = [number, number, number];

/** 페인트/림 아이템에 맞는 재질 (무지개는 매 프레임 색이 바뀜) */
export function useItemMaterial(it: ShopItem | undefined, fallback: string, base: { metalness: number; roughness: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(), []);
  useEffect(() => {
    mat.color.set(it?.color ?? fallback);
    mat.metalness = it?.metal ? 0.9 : base.metalness;
    mat.roughness = it?.metal ? 0.15 : base.roughness;
    mat.emissive.set(it?.glow ? (it.color ?? "#ffffff") : "#000000");
    mat.emissiveIntensity = it?.glow ? 0.9 : 0;
    mat.needsUpdate = true;
  }, [it, fallback, mat, base.metalness, base.roughness]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    if (it?.rainbow) {
      const h = (clock.getElapsedTime() * 0.15) % 1;
      mat.color.setHSL(h, 0.85, 0.55);
      if (it.glow) mat.emissive.setHSL(h, 0.9, 0.4);
    }
  });
  return mat;
}

export function Flag({ base }: { base: V3 }) {
  const flag = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(-0.42, -0.14);
    s.lineTo(0, -0.28);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useFrame(({ clock }) => {
    if (flag.current) flag.current.rotation.y = Math.PI / 2 + Math.sin(clock.getElapsedTime() * 7) * 0.35;
  });
  const top = base[1] + 1.25;
  return (
    <group>
      <mesh position={[base[0], (base[1] + top) / 2, base[2]]}>
        <cylinderGeometry args={[0.012, 0.012, top - base[1], 6]} />
        <meshStandardMaterial color="#eee" />
      </mesh>
      <mesh ref={flag} geometry={geo} position={[base[0], top, base[2]]}>
        <meshStandardMaterial color="#ff4d6d" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function HeadLight({ at }: { at: V3 }) {
  return (
    <group position={at}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.1, 14]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 0, 0.051]}>
        <circleGeometry args={[0.05, 14]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff3b0" emissiveIntensity={2} />
      </mesh>
      {/* 빛줄기 */}
      <mesh position={[0, -0.12, 1.1]} rotation={[-Math.PI / 2 + 0.12, 0, 0]}>
        <coneGeometry args={[0.55, 2.2, 20, 1, true]} />
        <meshBasicMaterial color="#fff3b0" transparent opacity={0.13} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Balloon({ from }: { from: V3 }) {
  const g = useRef<THREE.Group>(null);
  const str = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (g.current) {
      g.current.position.set(from[0] + Math.sin(t * 1.3) * 0.08, from[1] + 1.25 + Math.sin(t * 2) * 0.04, from[2] - 0.15 + Math.cos(t * 1.1) * 0.06);
      g.current.rotation.z = Math.sin(t * 1.3) * 0.15;
    }
  });
  return (
    <group>
      <mesh ref={str} position={[from[0], from[1] + 0.6, from[2] - 0.07]} rotation={[-0.12, 0, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 1.2, 4]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      <group ref={g}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.09, 0.08, 0]} castShadow>
            <sphereGeometry args={[0.13, 14, 12]} />
            <meshStandardMaterial color="#ff4d6d" roughness={0.25} />
          </mesh>
        ))}
        <mesh position={[0, -0.06, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.19, 0.25, 16]} />
          <meshStandardMaterial color="#ff4d6d" roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

/** 캐릭터 등에 붙는 날개 (Character 의 torso 그룹 안에서 사용) */
export function Wings({ anim }: { anim: AnimState }) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const sp = Math.min(1, Math.abs(anim.speed) / 8);
    const a = 0.35 + Math.sin(clock.getElapsedTime() * (3 + sp * 8)) * (0.15 + sp * 0.3);
    if (l.current) l.current.rotation.y = -a;
    if (r.current) r.current.rotation.y = a;
  });
  return (
    <group position={[0, 0.32, -0.18]} scale={1.7}>
      {[[-1, l], [1, r]].map(([s, ref]) => (
        <group key={s as number} ref={ref as React.RefObject<THREE.Group>}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[(s as number) * (0.2 + i * 0.12), 0.1 - i * 0.06, -0.02]} rotation={[0, 0, (s as number) * (0.5 - i * 0.25)]} scale={[1, 0.45, 0.15]} castShadow>
              <sphereGeometry args={[0.16 - i * 0.02, 12, 10]} />
              <meshStandardMaterial color="#ffffff" emissive="#fff8e7" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function Pet({ kind, at, anim }: { kind: string; at: V3; anim: AnimState }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.getElapsedTime();
    const bounce = Math.abs(Math.sin(t * (2 + Math.min(8, Math.abs(anim.speed))))) * 0.03;
    g.current.position.set(at[0], at[1] + bounce, at[2]);
    g.current.scale.setScalar(1.6);
    g.current.rotation.y = Math.sin(t * 0.7) * 0.4;
  });
  const look = (body: string, head: string, ears: React.ReactNode, snout: React.ReactNode) => (
    <group ref={g}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <sphereGeometry args={[0.1, 14, 12]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <group position={[0, 0.24, 0.03]}>
        <mesh castShadow>
          <sphereGeometry args={[0.095, 16, 14]} />
          <meshStandardMaterial color={head} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.035, 0.015, 0.085]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))}
        {ears}
        {snout}
      </group>
    </group>
  );
  if (kind === "pet_duck") {
    return look(
      "#ffe066",
      "#ffe066",
      <mesh position={[0, 0.09, -0.01]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#ffe066" />
      </mesh>,
      <mesh position={[0, -0.02, 0.1]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#ff9f1c" />
      </mesh>,
    );
  }
  if (kind === "pet_cat") {
    return look(
      "#f4a261",
      "#f4a261",
      <>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.055, 0.085, 0]} rotation={[0, 0, -s * 0.3]}>
            <coneGeometry args={[0.035, 0.07, 4]} />
            <meshStandardMaterial color="#e76f51" />
          </mesh>
        ))}
      </>,
      <mesh position={[0, -0.02, 0.09]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ff8fab" />
      </mesh>,
    );
  }
  return look(
    "#c68b59",
    "#e6c9a8",
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.09, -0.01, -0.01]} rotation={[0, 0, s * 0.25]} scale={[0.45, 1, 0.6]}>
          <sphereGeometry args={[0.06, 10, 8]} />
          <meshStandardMaterial color="#8d5524" />
        </mesh>
      ))}
    </>,
    <mesh position={[0, -0.025, 0.09]}>
      <sphereGeometry args={[0.022, 8, 8]} />
      <meshStandardMaterial color="#222" />
    </mesh>,
  );
}

const MAX = 70;
const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

/** 달릴 때 뒤에 남는 파티클 (월드 좌표) */
export function Trail({ kind, source, anim }: { kind: string; source: React.RefObject<THREE.Object3D | null>; anim: AnimState }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const parts = useRef(
    Array.from({ length: MAX }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, hue: 0 })),
  ).current;
  const next = useRef(0);
  const acc = useRef(0);
  const geo = useMemo(() => {
    if (kind === "trail_heart") return new THREE.SphereGeometry(0.09, 8, 6);
    if (kind === "trail_rainbow") return new THREE.BoxGeometry(0.16, 0.16, 0.16);
    return new THREE.OctahedronGeometry(0.08);
  }, [kind]);

  useFrame(({ clock }, dtRaw) => {
    const m = mesh.current;
    const src = source.current;
    if (!m || !src) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = clock.getElapsedTime();
    acc.current += dt;
    const moving = Math.abs(anim.speed) > 1.2;
    while (moving && acc.current > 0.035) {
      acc.current -= 0.035;
      const q = parts[next.current];
      next.current = (next.current + 1) % MAX;
      src.getWorldPosition(q.p);
      src.getWorldDirection(tmpV);
      q.p.addScaledVector(tmpV, -0.9 * Math.sign(anim.speed || 1));
      q.p.y += 0.35 + Math.random() * 0.6;
      q.p.x += (Math.random() - 0.5) * 0.3;
      q.p.z += (Math.random() - 0.5) * 0.3;
      q.v.set((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4);
      q.max = 0.9 + Math.random() * 0.4;
      q.life = q.max;
      q.hue = (t * 0.6) % 1;
    }
    if (!moving) acc.current = 0;
    for (let i = 0; i < MAX; i++) {
      const q = parts[i];
      if (q.life > 0) {
        q.life -= dt;
        q.p.addScaledVector(q.v, dt);
      }
      const k = Math.max(0, q.life / q.max);
      tmpV.copy(q.p);
      tmpQ.setFromAxisAngle(tmpS.set(0, 1, 0), t * 3 + i);
      const sc = k > 0 ? 0.4 + k * 0.8 : 0;
      tmpS.set(sc, sc, sc);
      tmpM.compose(tmpV, tmpQ, tmpS);
      m.setMatrixAt(i, tmpM);
      if (kind === "trail_rainbow") tmpC.setHSL(q.hue, 0.9, 0.6);
      else if (kind === "trail_heart") tmpC.set(i % 2 ? "#ff4d6d" : "#ff8fab");
      else tmpC.set(i % 3 ? "#ffd60a" : "#ffffff");
      m.setColorAt(i, tmpC);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, MAX]} frustumCulled={false}>
      <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.35} />
    </instancedMesh>
  );
}
