"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BOOSTS, BRIDGE, FERRIS, HOOPS, LAMPS, PLATFORMS, POND, SKATE, SPAWN, TRACK_RADIUS, TRACK_WIDTH, WINDMILLS,
} from "@/lib/world";

const RAINBOW = ["#ff595e", "#ff924c", "#ffca3a", "#8ac926", "#1982c4", "#4267ac", "#6a4c93"];

/** 공중 링 — 통과 시 반짝 (hoopFlash 에 시간 기록) */
export const hoopFlash: number[] = HOOPS.map(() => -10);

function Hoops() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const now = performance.now() / 1000;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      const f = Math.max(0, 1 - (now - hoopFlash[i]) / 0.8);
      mat.emissiveIntensity = 0.5 + Math.sin(t * 3 + i) * 0.2 + f * 2.5;
      m.scale.setScalar(1 + f * 0.3);
    });
  });
  return (
    <>
      {HOOPS.map((h, i) => (
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

function Boosts() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((g) => {
      if (!g) return;
      g.children.forEach((c, j) => {
        const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && "emissiveIntensity" in m) m.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 8 - j * 1.2)) * 1.6;
      });
    });
  });
  const arrow = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.9, -0.3);
    s.lineTo(0, 0.5);
    s.lineTo(0.9, -0.3);
    s.lineTo(0.9, -0.75);
    s.lineTo(0, 0.05);
    s.lineTo(-0.9, -0.75);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <>
      {BOOSTS.map((b, i) => (
        <group key={i} position={[b.x, 0.03, b.z]} rotation={[0, b.heading, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[3.2, 4.2]} />
            <meshStandardMaterial color="#3a0ca3" emissive="#3a0ca3" emissiveIntensity={0.3} />
          </mesh>
          <group ref={(el) => { refs.current[i] = el; }}>
            {[-1.2, 0, 1.2].map((z, j) => (
              <mesh key={j} geometry={arrow} position={[0, 0.02, z]} rotation={[-Math.PI / 2, 0, Math.PI]}>
                <meshStandardMaterial color="#4cc9f0" emissive="#4cc9f0" emissiveIntensity={1} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </>
  );
}

function StartLine() {
  const a = Math.atan2(SPAWN.z, SPAWN.x);
  const n = 12;
  const w = TRACK_WIDTH / n;
  const px = Math.cos(a) * TRACK_RADIUS + Math.sin(a) * 3;
  const pz = Math.sin(a) * TRACK_RADIUS - Math.cos(a) * 3;
  // 로컬 x = 트랙 가로(반지름 방향), 로컬 z = 진행 방향
  return (
    <group position={[px, 0, pz]} rotation={[0, -a, 0]}>
      {Array.from({ length: n * 2 }).map((_, k) => {
        const i = k % n;
        const j = Math.floor(k / n);
        return (
          <mesh key={k} position={[-TRACK_WIDTH / 2 + w * (i + 0.5), 0.025, (j - 0.5) * w]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[w, w]} />
            <meshStandardMaterial color={(i + j) % 2 ? "#111" : "#fff"} />
          </mesh>
        );
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (TRACK_WIDTH / 2 + 0.4), 2.6, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 5.2, 10]} />
          <meshStandardMaterial color="#ff7b54" />
        </mesh>
      ))}
      <mesh position={[0, 5.2, 0]} castShadow>
        <boxGeometry args={[TRACK_WIDTH + 1.6, 0.9, 0.5]} />
        <meshStandardMaterial color="#ff7b54" />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[-TRACK_WIDTH / 2 + i * (TRACK_WIDTH / 7), 5.2, -0.26]}>
          <sphereGeometry args={[0.18, 10, 8]} />
          <meshStandardMaterial color={RAINBOW[i % RAINBOW.length]} emissive={RAINBOW[i % RAINBOW.length]} emissiveIntensity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function PondAndBridge() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = -0.25 + Math.sin(clock.getElapsedTime() * 1.5) * 0.03;
  });
  return (
    <group>
      {/* 연못 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, 0.02, POND.z]} scale={[1, 1 / 1.4, 1]}>
        <circleGeometry args={[POND.r + 1.2, 48]} />
        <meshStandardMaterial color="#c9b79c" />
      </mesh>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} position={[POND.x, -0.25, POND.z]} scale={[1, 1 / 1.4, 1]}>
        <circleGeometry args={[POND.r, 48]} />
        <meshStandardMaterial color="#48cae4" transparent opacity={0.85} roughness={0.1} metalness={0.2} />
      </mesh>
      {[[-6, 98], [5, 106], [7, 97]].map(([x, z], i) => (
        <group key={i} position={[x, -0.18, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.8, 16]} />
            <meshStandardMaterial color="#52b788" />
          </mesh>
          <mesh position={[0.2, 0.12, 0]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshStandardMaterial color="#ffafcc" />
          </mesh>
        </group>
      ))}
      {/* 다리 난간 */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[BRIDGE.x, BRIDGE.h + 0.5, BRIDGE.z + s * (BRIDGE.width / 2 - 0.1)]} castShadow>
            <boxGeometry args={[BRIDGE.len, 0.12, 0.12]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} position={[BRIDGE.x - BRIDGE.len / 2 + i * (BRIDGE.len / 8), BRIDGE.h + 0.25, BRIDGE.z + s * (BRIDGE.width / 2 - 0.1)]}>
              <boxGeometry args={[0.12, 0.5, 0.12]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
          ))}
        </group>
      ))}
      {/* 무지개 아치 */}
      {RAINBOW.map((c, i) => (
        <mesh key={c} position={[BRIDGE.x, BRIDGE.h, BRIDGE.z]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[9.5 - i * 0.38, 0.19, 8, 48, Math.PI]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* 구름 받침 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[BRIDGE.x, BRIDGE.h, BRIDGE.z + s * 8.4]}>
          {[[0, 0, 0, 1.1], [0.8, -0.2, 0.5, 0.8], [-0.7, -0.2, -0.4, 0.8], [0, 0.5, 0, 0.7]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <sphereGeometry args={[r, 12, 10]} />
              <meshStandardMaterial color="#fff" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Platforms() {
  return (
    <>
      {PLATFORMS.map((p, i) => (
        <mesh key={i} position={[p.x, p.h / 2, p.z]} castShadow receiveShadow>
          <boxGeometry args={[p.w, p.h, p.d]} />
          <meshStandardMaterial color={p.color} />
        </mesh>
      ))}
    </>
  );
}

function SkatePark() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SKATE.x, 0.014, SKATE.z]} receiveShadow>
        <circleGeometry args={[SKATE.r, 48]} />
        <meshStandardMaterial color="#d6d6d6" roughness={0.9} />
      </mesh>
      {/* 그래피티 느낌의 원 */}
      {["#ff006e", "#8338ec", "#3a86ff", "#ffbe0b"].map((c, i) => (
        <mesh key={c} rotation={[-Math.PI / 2, 0, 0]} position={[SKATE.x + Math.cos(i * 1.6) * 14, 0.018, SKATE.z + Math.sin(i * 1.6) * 14]}>
          <ringGeometry args={[1.4, 2, 24]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      {/* 레일 (장식) */}
      <mesh position={[SKATE.x, 0.6, SKATE.z + 18]} castShadow>
        <boxGeometry args={[10, 0.1, 0.1]} />
        <meshStandardMaterial color="#ffd60a" metalness={0.7} roughness={0.2} />
      </mesh>
      {[-4, 0, 4].map((x) => (
        <mesh key={x} position={[SKATE.x + x, 0.3, SKATE.z + 18]}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      ))}
    </group>
  );
}

function FerrisWheel() {
  const wheel = useRef<THREE.Group>(null);
  const cabins = useRef<(THREE.Group | null)[]>([]);
  const N = 8;
  useFrame((_, dt) => {
    if (!wheel.current) return;
    wheel.current.rotation.z += dt * 0.25;
    const rot = wheel.current.rotation.z;
    cabins.current.forEach((c) => c && (c.rotation.z = -rot));
  });
  const colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff924c", "#4cc9f0", "#f72585"];
  return (
    <group position={[FERRIS.x, 0, FERRIS.z]}>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 1.6, 5.5, -0.6]} rotation={[0.1, 0, s * 0.28]} castShadow>
            <cylinderGeometry args={[0.2, 0.25, 11.5, 8]} />
            <meshStandardMaterial color="#e9ecef" />
          </mesh>
          <mesh position={[s * 1.6, 5.5, 0.6]} rotation={[-0.1, 0, s * 0.28]} castShadow>
            <cylinderGeometry args={[0.2, 0.25, 11.5, 8]} />
            <meshStandardMaterial color="#e9ecef" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.3, 3]}>
        <boxGeometry args={[3, 0.6, 2]} />
        <meshStandardMaterial color="#ffafcc" />
      </mesh>
      <group ref={wheel} position={[0, 11, 0]}>
        <mesh>
          <torusGeometry args={[FERRIS.r, 0.15, 8, 64]} />
          <meshStandardMaterial color="#f8f9fa" emissive="#ffd6ff" emissiveIntensity={0.3} />
        </mesh>
        <mesh>
          <torusGeometry args={[FERRIS.r * 0.6, 0.1, 8, 48]} />
          <meshStandardMaterial color="#f8f9fa" />
        </mesh>
        {Array.from({ length: N }).map((_, i) => {
          const a = (i / N) * Math.PI * 2;
          return (
            <group key={i}>
              <mesh rotation={[0, 0, a]} position={[Math.cos(a + Math.PI / 2) * -FERRIS.r / 2, Math.sin(a + Math.PI / 2) * -FERRIS.r / 2, 0]}>
                <boxGeometry args={[0.08, FERRIS.r, 0.08]} />
                <meshStandardMaterial color="#dee2e6" />
              </mesh>
              <group position={[Math.cos(a) * FERRIS.r, Math.sin(a) * FERRIS.r, 0]} ref={(el) => { cabins.current[i] = el; }}>
                <mesh position={[0, -0.9, 0]} castShadow>
                  <boxGeometry args={[1.3, 1.1, 1.3]} />
                  <meshStandardMaterial color={colors[i]} />
                </mesh>
                <mesh position={[0, -0.25, 0]}>
                  <coneGeometry args={[0.95, 0.4, 4]} />
                  <meshStandardMaterial color="#fff" />
                </mesh>
              </group>
            </group>
          );
        })}
        <mesh>
          <sphereGeometry args={[0.6, 16, 12]} />
          <meshStandardMaterial color="#ffd60a" emissive="#ffb703" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

function Windmill({ x, z, phase }: { x: number; z: number; phase: number }) {
  const blades = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (blades.current) blades.current.rotation.z += dt * 0.8;
  });
  return (
    <group position={[x, 0, z]} rotation={[0, phase, 0]}>
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[1.2, 2.2, 8, 8]} />
        <meshStandardMaterial color="#fefae0" />
      </mesh>
      <mesh position={[0, 8.9, 0]} castShadow>
        <coneGeometry args={[1.7, 2, 8]} />
        <meshStandardMaterial color="#bc4749" />
      </mesh>
      <mesh position={[0, 1, 2.05]}>
        <planeGeometry args={[1, 2]} />
        <meshStandardMaterial color="#6f4518" />
      </mesh>
      <group ref={blades} position={[0, 7.6, 1.6]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]} position={[Math.cos((i * Math.PI) / 2 + Math.PI / 2) * 2.6, Math.sin((i * Math.PI) / 2 + Math.PI / 2) * 2.6, 0]} castShadow>
            <boxGeometry args={[0.9, 5, 0.08]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.4, 10]} />
          <meshStandardMaterial color="#6f4518" />
        </mesh>
      </group>
    </group>
  );
}

function Balloons() {
  const g = useRef<THREE.Group>(null);
  const list = useMemo(
    () =>
      [
        ["#ff595e", "#ffca3a"], ["#1982c4", "#ffffff"], ["#8ac926", "#ffca3a"], ["#6a4c93", "#ff924c"], ["#f72585", "#4cc9f0"],
      ].map((c, i) => ({ c, a: (i / 5) * Math.PI * 2, r: 50 + i * 14, y: 24 + (i % 3) * 7, sp: 0.02 + i * 0.006 })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g.current?.children.forEach((b, i) => {
      const L = list[i];
      const a = L.a + t * L.sp;
      b.position.set(Math.cos(a) * L.r, L.y + Math.sin(t * 0.5 + i) * 1.5, Math.sin(a) * L.r);
    });
  });
  return (
    <group ref={g}>
      {list.map((b, i) => (
        <group key={i}>
          {Array.from({ length: 8 }).map((_, j) => (
            <mesh key={j} scale={[1, 1.15, 1]}>
              <sphereGeometry args={[3, 16, 14, (j / 8) * Math.PI * 2, Math.PI / 4]} />
              <meshStandardMaterial color={b.c[j % 2]} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <mesh position={[0, -4.6, 0]}>
            <boxGeometry args={[1.1, 0.9, 1.1]} />
            <meshStandardMaterial color="#8d5524" />
          </mesh>
          {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], k) => (
            <mesh key={k} position={[x, -3.6, z]}>
              <cylinderGeometry args={[0.02, 0.02, 1.4, 4]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Lamps() {
  return (
    <>
      {LAMPS.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh position={[0, 1.8, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 3.6, 8]} />
            <meshStandardMaterial color="#343a40" />
          </mesh>
          <mesh position={[0, 3.75, 0]}>
            <sphereGeometry args={[0.3, 12, 10]} />
            <meshStandardMaterial color="#fff3b0" emissive="#ffd166" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Flowers() {
  const list = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = [];
    const cols = ["#ff595e", "#ffca3a", "#ffafcc", "#ffffff", "#cdb4db"];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = 16.5 + (i % 3) * 0.5;
      if (Math.abs(Math.cos(a)) > 0.97 || Math.abs(Math.sin(a)) > 0.97) continue; // 길 비우기
      out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, c: cols[i % cols.length] });
    }
    return out;
  }, []);
  return (
    <>
      {list.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.36, 4]} />
            <meshStandardMaterial color="#2d6a4f" />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color={f.c} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Landmarks() {
  return (
    <group>
      <SkatePark />
      <Platforms />
      <PondAndBridge />
      <Hoops />
      <Boosts />
      <StartLine />
      <FerrisWheel />
      {WINDMILLS.map((w, i) => (
        <Windmill key={i} x={w.x} z={w.z} phase={Math.atan2(-w.x, -w.z)} />
      ))}
      <Balloons />
      <Lamps />
      <Flowers />
    </group>
  );
}
