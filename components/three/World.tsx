"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Landmarks } from "./Landmarks";
import {
  HOUSES, PLAZA_RADIUS, RAMPS, STAR_COUNT, TRACK_RADIUS, TRACK_WIDTH, TREES,
  WORLD_SIZE,
} from "@/lib/world";
import { getMap, groundHeight, randomStarPos } from "@/lib/maps";
import { SnowWorld } from "./SnowWorld";
import { DesertWorld } from "./DesertWorld";
import { CourseGates, Hoops } from "./Common";
import { Skids } from "./Skids";

function RampMesh({ length, width, height, color }: { length: number; width: number; height: number; color: string }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-length / 2, 0);
    shape.lineTo(length / 2, 0);
    shape.lineTo(length / 2, height);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    g.translate(0, 0, -width / 2);
    return g;
  }, [length, width, height]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function Trees() {
  return (
    <>
      {TREES.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.25, 1.2, 8]} />
            <meshStandardMaterial color="#8d5524" />
          </mesh>
          {t.kind === "blossom" ? (
            <>
              <mesh position={[0, 2.1, 0]} castShadow>
                <icosahedronGeometry args={[1.25, 1]} />
                <meshStandardMaterial color={["#ffafcc", "#ffc8dd", "#f7aef8"][Math.floor(t.scale * 10) % 3]} flatShading />
              </mesh>
              <mesh position={[0.7, 2.6, 0.3]} castShadow>
                <icosahedronGeometry args={[0.7, 1]} />
                <meshStandardMaterial color="#ffc8dd" flatShading />
              </mesh>
            </>
          ) : t.kind === "pine" ? (
            <>
              <mesh position={[0, 1.8, 0]} castShadow>
                <coneGeometry args={[1.2, 1.8, 8]} />
                <meshStandardMaterial color={t.color} flatShading />
              </mesh>
              <mesh position={[0, 2.7, 0]} castShadow>
                <coneGeometry args={[0.85, 1.4, 8]} />
                <meshStandardMaterial color={t.color} flatShading />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 2.1, 0]} castShadow>
              <icosahedronGeometry args={[1.2, 1]} />
              <meshStandardMaterial color={t.color} flatShading />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function Houses() {
  return (
    <>
      {HOUSES.map((h, i) => (
        <group key={i} position={[h.x, 0, h.z]} rotation={[0, h.rot, 0]}>
          <mesh position={[0, h.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[h.w, h.h, h.d]} />
            <meshStandardMaterial color={h.wall} />
          </mesh>
          <mesh position={[0, h.h + 1.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[Math.max(h.w, h.d) * 0.78, 2.2, 4]} />
            <meshStandardMaterial color={h.roof} flatShading />
          </mesh>
          <mesh position={[0, 0.9, h.d / 2 + 0.01]}>
            <planeGeometry args={[1, 1.8]} />
            <meshStandardMaterial color="#8d5524" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * h.w * 0.28, h.h * 0.6, h.d / 2 + 0.01]}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshStandardMaterial color="#bde0fe" emissive="#bde0fe" emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Track() {
  const dashes = useMemo(() => Array.from({ length: 64 }, (_, i) => (i / 64) * Math.PI * 2), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <ringGeometry args={[TRACK_RADIUS - TRACK_WIDTH / 2, TRACK_RADIUS + TRACK_WIDTH / 2, 128]} />
        <meshStandardMaterial color="#6c757d" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[TRACK_RADIUS + s * (TRACK_WIDTH / 2) - 0.25, TRACK_RADIUS + s * (TRACK_WIDTH / 2), 128]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      {dashes.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * TRACK_RADIUS, 0.02, Math.sin(a) * TRACK_RADIUS]} rotation={[-Math.PI / 2, 0, -a]}>
          <planeGeometry args={[0.25, 2.2]} />
          <meshStandardMaterial color="#ffd166" />
        </mesh>
      ))}
      {/* 광장으로 가는 길 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 2]} position={[0, 0.008, 0]} receiveShadow>
          <planeGeometry args={[4, TRACK_RADIUS * 2]} />
          <meshStandardMaterial color="#e9c46a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Plaza() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = 0.75 + Math.sin(clock.getElapsedTime() * 2) * 0.03;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow>
        <circleGeometry args={[PLAZA_RADIUS, 48]} />
        <meshStandardMaterial color="#f4e1c1" />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[4, 4.2, 0.8, 32]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh ref={water} position={[0, 0.75, 0]}>
        <cylinderGeometry args={[3.6, 3.6, 0.1, 32]} />
        <meshStandardMaterial color="#4cc9f0" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 1.8, 12]} />
        <meshStandardMaterial color="#dee2e6" />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <sphereGeometry args={[0.6, 16, 12]} />
        <meshStandardMaterial color="#ffafcc" />
      </mesh>
    </group>
  );
}

function Clouds() {
  const g = useRef<THREE.Group>(null);
  const clouds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: Math.cos(i * 1.7) * (60 + (i % 4) * 25),
        z: Math.sin(i * 1.7) * (60 + (i % 4) * 25),
        y: 28 + (i % 3) * 6,
        s: 1.5 + (i % 3),
      })),
    [],
  );
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.01;
  });
  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[[0, 0, 0, 2], [1.8, -0.3, 0, 1.5], [-1.8, -0.3, 0.3, 1.4], [0.6, 0.8, 0, 1.3]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <sphereGeometry args={[r, 12, 10]} />
              <meshStandardMaterial color="#ffffff" flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Mountains() {
  const list = useMemo(
    () => Array.from({ length: 18 }, (_, i) => {
      const a = (i / 18) * Math.PI * 2;
      const r = WORLD_SIZE + 40 + (i % 3) * 15;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 30 + ((i * 7) % 5) * 8, w: 28 + (i % 4) * 6 };
    }),
    [],
  );
  return (
    <>
      {list.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position={[0, m.h / 2, 0]}>
            <coneGeometry args={[m.w, m.h, 7]} />
            <meshStandardMaterial color={i % 2 ? "#95d5b2" : "#74c69d"} flatShading />
          </mesh>
          <mesh position={[0, m.h * 0.86, 0]}>
            <coneGeometry args={[m.w * 0.28, m.h * 0.28, 7]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Fence() {
  const posts = useMemo(() => {
    const out: [number, number, number][] = [];
    const S = WORLD_SIZE + 1;
    for (let i = -S; i <= S; i += 6) {
      out.push([i, 0, -S], [i, 0, S], [-S, 0, i], [S, 0, i]);
    }
    return out;
  }, []);
  return (
    <>
      {posts.map((p, i) => (
        <mesh key={i} position={[p[0], 0.5, p[2]]}>
          <boxGeometry args={[0.25, 1, 0.25]} />
          <meshStandardMaterial color="#f8f9fa" />
        </mesh>
      ))}
    </>
  );
}

/** 별 수집: 위치는 공유 객체(stars)에 있고, 플레이어가 먹으면 재배치 */
export const stars: { x: number; z: number }[] = [];

function resetStars() {
  stars.length = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    const [x, z] = randomStarPos();
    stars.push({ x, z });
  }
}

function Stars() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.55 : 0.24;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    g.center();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const s = stars[i];
      g.position.set(s.x, groundHeight(s.x, s.z) + 1.3 + Math.sin(t * 2 + i) * 0.2, s.z);
      g.rotation.y = t * 2 + i;
    });
  });
  return (
    <>
      {stars.map((_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh geometry={geo} castShadow>
            <meshStandardMaterial color="#ffd60a" emissive="#ffb703" emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function World() {
  const [map] = useState(() => {
    resetStars();
    return getMap();
  });
  return (
    <group>
      <Stars />
      <Hoops />
      <CourseGates />
      <Skids dark={map.id === "snow" ? "#7d93ad" : map.id === "desert" ? "#7a4b2a" : "#2b2b2b"} />
      {map.id === "snow" ? <SnowWorld /> : map.id === "desert" ? <DesertWorld /> : <VillageWorld />}
    </group>
  );
}

function VillageWorld() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD_SIZE * 4, WORLD_SIZE * 4]} />
        <meshStandardMaterial color="#a7d676" roughness={1} />
      </mesh>
      <Track />
      <Plaza />
      {RAMPS.map((r, i) => (
        <group key={i} position={[r.x, 0, r.z]} rotation={[0, r.rot, 0]}>
          <RampMesh length={r.length} width={r.width} height={r.height} color={r.color} />
        </group>
      ))}
      <Trees />
      <Landmarks />
      <Houses />
      <Fence />
      <Clouds />
      <Mountains />
    </group>
  );
}
