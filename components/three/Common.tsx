"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getMap, groundHeight, hoopFlash } from "@/lib/maps";
import { race } from "../game/state";

/** 공중 링 — 통과하면 반짝 */
export function Hoops() {
  const hoops = getMap().hoops;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const now = performance.now() / 1000;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const f = Math.max(0, 1 - (now - (hoopFlash[i] ?? -10)) / 0.8);
      mat.emissiveIntensity = 0.5 + Math.sin(t * 3 + i) * 0.2 + f * 2.5;
      m.scale.setScalar(1 + f * 0.3);
    });
  });
  return (
    <>
      {hoops.map((h, i) => (
        <group key={i} position={[h.x, h.y, h.z]} rotation={[0, h.face, 0]}>
          <mesh ref={(el) => { refs.current[i] = el; }}>
            <torusGeometry args={[h.r, 0.16, 12, 40]} />
            <meshStandardMaterial color="#ffd60a" emissive="#ff9e00" emissiveIntensity={0.6} metalness={0.5} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** 타임어택 게이트 (깃발 기둥 두 개). 다음 목표 게이트는 빛남 */
export function CourseGates() {
  const course = getMap().course;
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const target = i === race.next;
      g.children.forEach((c) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.emissive) m.emissiveIntensity = target ? 0.8 + Math.sin(t * 6) * 0.4 : 0.15;
      });
    });
  });
  return (
    <>
      {course.gates.map((gt, i) => {
        const y = groundHeight(gt.x, gt.z);
        const isStart = i === 0;
        const isEnd = course.kind === "run" && i === course.gates.length - 1;
        const col = isStart ? "#2dc653" : isEnd ? "#e63946" : i % 2 ? "#3a86ff" : "#ff006e";
        // heading 기준 가로 방향
        const px = Math.cos(gt.heading);
        const pz = -Math.sin(gt.heading);
        return (
          <group key={i}>
            <group ref={(el) => { refs.current[i] = el; }}>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[gt.x + px * s * gt.w / 2, y + 1.3, gt.z + pz * s * gt.w / 2]}>
                  <cylinderGeometry args={[0.09, 0.09, 2.6, 8]} />
                  <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.2} />
                </mesh>
              ))}
              {[-1, 1].map((s) => (
                <mesh key={`f${s}`} position={[gt.x + px * s * (gt.w / 2 - 0.35), y + 2.3, gt.z + pz * s * (gt.w / 2 - 0.35)]} rotation={[0, gt.heading + Math.PI / 2, 0]}>
                  <boxGeometry args={[0.7, 0.45, 0.03]} />
                  <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.2} />
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </>
  );
}
