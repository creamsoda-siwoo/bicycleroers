"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ADOBES, CACTI, DESERT_RAMPS, DESERT_SIZE, GAP, MESAS, OASIS, PALMS, ROAD, ROAD_HALF, TOWN, desertTerrain,
} from "@/lib/desert";

function Terrain() {
  const geo = useMemo(() => {
    const size = DESERT_SIZE * 2 + 140;
    const seg = 170;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const c = new THREE.Color();
    const sandA = new THREE.Color("#f2c98b");
    const sandB = new THREE.Color("#e3a868");
    const rock = new THREE.Color("#9c5a3c");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = desertTerrain(x, z);
      pos.setY(i, h);
      if (h < -0.6) c.copy(rock).lerp(new THREE.Color("#6d3b26"), Math.min(1, -h / 4));
      else c.copy(sandA).lerp(sandB, Math.min(1, Math.max(0, h / 3.5)) * 0.8 + Math.sin(x * 0.5) * Math.cos(z * 0.45) * 0.08);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}

/** 길 리본 (협곡 틈 구간은 끊김) */
function Road() {
  const { road, line } = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const lpos: number[] = [];
    const lidx: number[] = [];
    let vi = 0;
    let li = 0;
    const inGap = (x: number, z: number) => {
      const dx = x - GAP.x;
      const dz = z - GAP.z;
      return Math.abs(dx * Math.sin(GAP.h) + dz * Math.cos(GAP.h)) < GAP.half + 0.6 && Math.hypot(dx, dz) < 12;
    };
    for (let k = 0; k < ROAD.length - 1; k++) {
      const a = ROAD[k];
      const b = ROAD[k + 1];
      if (inGap(a.x, a.z) || inGap(b.x, b.z)) continue;
      const pts = [a, b].flatMap((p) => {
        const px = Math.cos(p.h);
        const pz = -Math.sin(p.h);
        const y = Math.max(desertTerrain(p.x, p.z), 0) + 0.04;
        return [
          [p.x - px * ROAD_HALF, y, p.z - pz * ROAD_HALF],
          [p.x + px * ROAD_HALF, y, p.z + pz * ROAD_HALF],
        ];
      });
      pts.forEach((p) => pos.push(...p));
      idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2);
      vi += 4;
      // 가운데 점선
      if (k % 3 === 0) {
        const lp = [a, b].flatMap((p) => {
          const px = Math.cos(p.h) * 0.12;
          const pz = -Math.sin(p.h) * 0.12;
          const y = Math.max(desertTerrain(p.x, p.z), 0) + 0.06;
          return [[p.x - px, y, p.z - pz], [p.x + px, y, p.z + pz]];
        });
        lp.forEach((p) => lpos.push(...p));
        lidx.push(li, li + 1, li + 2, li + 1, li + 3, li + 2);
        li += 4;
      }
    }
    const mk = (p: number[], i: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      g.setIndex(i);
      g.computeVertexNormals();
      return g;
    };
    return { road: mk(pos, idx), line: mk(lpos, lidx) };
  }, []);
  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial color="#b0805a" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={line}>
        <meshStandardMaterial color="#fff1d6" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Mesas() {
  const cols = ["#c8553d", "#d9773f", "#b5452f", "#e08e45"];
  return (
    <>
      {MESAS.map((m, i) => {
        const y = desertTerrain(m.x, m.z) - 0.5;
        const layers = 3;
        return (
          <group key={i} position={[m.x, y, m.z]} rotation={[0, i, 0]}>
            {Array.from({ length: layers }).map((_, k) => {
              const hh = m.h / layers;
              const r0 = m.r * (1.15 - k * 0.12);
              return (
                <mesh key={k} position={[0, hh * k + hh / 2, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[r0 * 0.92, r0, hh, 7]} />
                  <meshStandardMaterial color={cols[(i + k) % cols.length]} flatShading roughness={1} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

function Cacti() {
  return (
    <>
      {CACTI.map((c, i) => (
        <group key={i} position={[c.x, desertTerrain(c.x, c.z), c.z]} scale={c.s} rotation={[0, i * 2.1, 0]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <capsuleGeometry args={[0.28, 1.9, 6, 10]} />
            <meshStandardMaterial color="#5a8f3c" />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.45, 1.1 + (s > 0 ? 0.3 : 0), 0]}>
              <mesh rotation={[0, 0, s * 1.57]} position={[-s * 0.15, 0, 0]}>
                <capsuleGeometry args={[0.17, 0.35, 4, 8]} />
                <meshStandardMaterial color="#5a8f3c" />
              </mesh>
              <mesh position={[0, 0.4, 0]}>
                <capsuleGeometry args={[0.17, 0.6, 4, 8]} />
                <meshStandardMaterial color="#5a8f3c" />
              </mesh>
            </group>
          ))}
          {i % 4 === 0 && (
            <mesh position={[0, 2.5, 0]}>
              <sphereGeometry args={[0.14, 8, 6]} />
              <meshStandardMaterial color="#ff70a6" />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

function Town() {
  return (
    <group>
      {ADOBES.map((a, i) => {
        const y = desertTerrain(a.x, a.z);
        return (
          <group key={i} position={[a.x, y, a.z]} rotation={[0, i * 0.4, 0]}>
            <mesh position={[0, a.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[a.w, a.h, a.d]} />
              <meshStandardMaterial color={a.c} roughness={1} />
            </mesh>
            <mesh position={[0, a.h + 0.15, 0]}>
              <boxGeometry args={[a.w + 0.3, 0.3, a.d + 0.3]} />
              <meshStandardMaterial color="#c08552" />
            </mesh>
            {[-2, -0.7, 0.7, 2].map((x) => (
              <mesh key={x} position={[x * (a.w / 5), a.h - 0.5, a.d / 2 + 0.25]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.6, 6]} />
                <meshStandardMaterial color="#6f4518" />
              </mesh>
            ))}
            <mesh position={[0, 1, a.d / 2 + 0.01]}>
              <planeGeometry args={[1.1, 2]} />
              <meshStandardMaterial color="#5e3a1a" />
            </mesh>
            <mesh position={[a.w * 0.28, a.h * 0.62, a.d / 2 + 0.01]}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshStandardMaterial color="#2a9d8f" />
            </mesh>
          </group>
        );
      })}
      {/* 마을 우물 */}
      <group position={[TOWN.x, desertTerrain(TOWN.x, TOWN.z), TOWN.z]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1.2, 1.3, 1, 16]} />
          <meshStandardMaterial color="#a68a64" />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.1, 1.6, 0]}>
            <boxGeometry args={[0.15, 2.2, 0.15]} />
            <meshStandardMaterial color="#6f4518" />
          </mesh>
        ))}
        <mesh position={[0, 2.8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[1.2, 2.8, 4]} />
          <meshStandardMaterial color="#bc6c25" />
        </mesh>
      </group>
    </group>
  );
}

function Oasis() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[OASIS.x, 0.02, OASIS.z]}>
        <circleGeometry args={[OASIS.r + 1.8, 40]} />
        <meshStandardMaterial color="#8fb15b" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[OASIS.x, -0.25, OASIS.z]}>
        <circleGeometry args={[OASIS.r, 40]} />
        <meshStandardMaterial color="#2ec4b6" transparent opacity={0.88} roughness={0.1} />
      </mesh>
      {PALMS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} scale={p.s} rotation={[0, i * 1.7, 0]}>
          {Array.from({ length: 6 }).map((_, k) => (
            <mesh key={k} position={[Math.sin(k * 0.25) * 0.4, 0.5 + k * 0.9, 0]} rotation={[0, 0, -0.08]} castShadow>
              <cylinderGeometry args={[0.2, 0.24, 0.95, 7]} />
              <meshStandardMaterial color={k % 2 ? "#8d6346" : "#a47148"} />
            </mesh>
          ))}
          {Array.from({ length: 7 }).map((_, k) => (
            <mesh key={`l${k}`} position={[0.9, 5.6, 0]} rotation={[0, (k / 7) * Math.PI * 2, -0.5]} castShadow>
              <boxGeometry args={[0.6, 0.06, 3.6]} />
              <meshStandardMaterial color="#4f9d3a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Ramps() {
  return (
    <>
      {DESERT_RAMPS.map((r, i) => {
        const shape = new THREE.Shape();
        shape.moveTo(-r.length / 2, -0.3);
        shape.lineTo(r.length / 2, -0.3);
        shape.lineTo(r.length / 2, r.height);
        shape.lineTo(-r.length / 2, 0);
        shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false });
        g.translate(0, 0, -r.width / 2);
        return (
          <group key={i} position={[r.x, Math.max(0, desertTerrain(r.x, r.z)), r.z]} rotation={[0, r.rot, 0]}>
            <mesh geometry={g} castShadow receiveShadow>
              <meshStandardMaterial color={r.color} roughness={0.8} />
            </mesh>
            {/* 나무 판자 줄무늬 */}
            {Array.from({ length: 5 }).map((_, k) => (
              <mesh key={k} position={[-r.length / 2 + (k + 0.5) * (r.length / 5), (r.height * (k + 0.5)) / 5 + 0.03, 0]} rotation={[0, 0, Math.atan2(r.height, r.length)]}>
                <boxGeometry args={[0.08, 0.02, r.width]} />
                <meshStandardMaterial color="#7f4f24" />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

/** 협곡 틈 앞 경고 표지판 */
function GapSigns() {
  const sx = Math.cos(GAP.h);
  const sz = -Math.sin(GAP.h);
  const back = GAP.half + 16;
  const bx = GAP.x - Math.sin(GAP.h) * back;
  const bz = GAP.z - Math.cos(GAP.h) * back;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[bx + sx * s * (ROAD_HALF + 1.2), 0, bz + sz * s * (ROAD_HALF + 1.2)]} rotation={[0, GAP.h + Math.PI, 0]}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2, 6]} />
            <meshStandardMaterial color="#6f4518" />
          </mesh>
          <mesh position={[0, 2.2, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[1.1, 1.1, 0.06]} />
            <meshStandardMaterial color="#ffb703" emissive="#ffb703" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 2.25, -0.04]}>
            <boxGeometry args={[0.14, 0.55, 0.02]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 1.88, -0.04]}>
            <boxGeometry args={[0.14, 0.12, 0.02]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 굴러다니는 회전초 */
function Tumbleweeds() {
  const g = useRef<THREE.Group>(null);
  const list = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({ cx: -100 + i * 28, cz: -40 + (i % 3) * 50, sp: 4 + (i % 3) * 1.5, ph: i * 1.3 })),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g.current?.children.forEach((c, i) => {
      const L = list[i];
      const x = L.cx + ((t * L.sp + L.ph * 20) % 120) - 60;
      const z = L.cz + Math.sin(t * 0.7 + L.ph) * 6;
      const y = Math.max(0, desertTerrain(x, z)) + 0.55 + Math.abs(Math.sin(t * 3 + L.ph)) * 0.6;
      c.position.set(x, y, z);
      c.rotation.set(t * 3, 0, t * 2);
    });
  });
  return (
    <group ref={g}>
      {list.map((_, i) => (
        <mesh key={i} castShadow>
          <icosahedronGeometry args={[0.55, 1]} />
          <meshStandardMaterial color="#a47148" wireframe />
        </mesh>
      ))}
    </group>
  );
}

function SunsetSky() {
  return (
    <group>
      <mesh position={[0, 28, -300]}>
        <circleGeometry args={[34, 40]} />
        <meshBasicMaterial color="#ffd27d" fog={false} />
      </mesh>
      <mesh position={[0, 28, -301]}>
        <circleGeometry args={[52, 40]} />
        <meshBasicMaterial color="#ffb085" transparent opacity={0.45} fog={false} />
      </mesh>
      {/* 먼 메사 실루엣 */}
      {Array.from({ length: 22 }).map((_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const r = DESERT_SIZE + 70 + (i % 3) * 20;
        const h = 18 + ((i * 7) % 5) * 7;
        return (
          <mesh key={i} position={[Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r]}>
            <cylinderGeometry args={[14 + (i % 4) * 3, 18 + (i % 4) * 3, h, 6]} />
            <meshStandardMaterial color={i % 2 ? "#b5543c" : "#a2462f"} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

export function DesertWorld() {
  return (
    <group>
      <Terrain />
      <Road />
      <Ramps />
      <GapSigns />
      <Mesas />
      <Cacti />
      <Town />
      <Oasis />
      <Tumbleweeds />
      <SunsetSky />
    </group>
  );
}
