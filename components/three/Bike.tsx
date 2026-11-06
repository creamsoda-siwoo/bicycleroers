"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BikeSpec } from "@/lib/bikes";
import { Tube } from "./Tube";
import { Wheel } from "./Wheel";
import type { AnimState } from "./anim";
import { item, type Equipped } from "@/lib/shop";
import { Balloon, Flag, HeadLight, Pet, useItemMaterial } from "./Custom";

type V3 = [number, number, number];

const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const off = (p: V3, x: number): V3 => [p[0] + x, p[1], p[2]];

export function crankLength(spec: BikeSpec) {
  return Math.min(0.17, spec.bb[0] - 0.08);
}

export function crankAngle(spec: BikeSpec, dist: number) {
  return dist / spec.wheel / spec.gear;
}

function Saddle({ p, color = "#333" }: { p: V3; color?: string }) {
  return (
    <group position={p}>
      <mesh castShadow position={[0, 0.02, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.02, 0.1]} scale={[0.5, 0.4, 1]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Grip({ p }: { p: V3 }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.022, 0.022, 0.1, 10]} />
      <meshStandardMaterial color="#1d1d1d" />
    </mesh>
  );
}

function Handlebar({ spec, p }: { spec: BikeSpec; p: V3 }) {
  const metal = "#d0d0d0";
  switch (spec.id) {
    case "road":
      return (
        <group>
          <Tube a={off(p, -0.21)} b={off(p, 0.21)} r={0.016} color={spec.accent} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Tube a={off(p, 0.21 * s)} b={[0.21 * s, p[1] - 0.04, p[2] + 0.1]} r={0.016} color={spec.accent} />
              <Tube a={[0.21 * s, p[1] - 0.04, p[2] + 0.1]} b={[0.21 * s, p[1] - 0.14, p[2] + 0.05]} r={0.016} color={spec.accent} />
              <Tube a={[0.21 * s, p[1] - 0.14, p[2] + 0.05]} b={[0.21 * s, p[1] - 0.15, p[2] - 0.05]} r={0.016} color={spec.accent} />
            </group>
          ))}
        </group>
      );
    case "cruiser":
      return (
        <group>
          <Tube a={off(p, -0.2)} b={off(p, 0.2)} r={0.016} color={metal} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Tube a={off(p, 0.2 * s)} b={[0.32 * s, p[1] + 0.04, p[2] - 0.18]} r={0.016} color={metal} />
              <Grip p={[0.33 * s, p[1] + 0.04, p[2] - 0.2]} />
            </group>
          ))}
        </group>
      );
    case "bmx":
    case "tricycle":
      return (
        <group>
          <Tube a={[-0.1, p[1] - 0.15, p[2]]} b={off(p, -0.28)} r={0.016} color={metal} />
          <Tube a={[0.1, p[1] - 0.15, p[2]]} b={off(p, 0.28)} r={0.016} color={metal} />
          <Tube a={[-0.12, p[1] - 0.08, p[2]]} b={[0.12, p[1] - 0.08, p[2]]} r={0.012} color={metal} />
          <Grip p={off(p, -0.3)} />
          <Grip p={off(p, 0.3)} />
        </group>
      );
    default: {
      const w = spec.id === "mtb" ? 0.32 : 0.26;
      return (
        <group>
          <Tube a={off(p, -w)} b={off(p, w)} r={0.016} color={spec.id === "fixie" ? spec.accent : metal} />
          <Grip p={off(p, -w + 0.04)} />
          <Grip p={off(p, w - 0.04)} />
        </group>
      );
    }
  }
}

/** 크랭크 + 페달 */
function Crank({ spec, at, anim, color }: { spec: BikeSpec; at: V3; anim: AnimState; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const L = crankLength(spec);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = anim.crank;
  });
  return (
    <group position={at}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.02, 20]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
      </mesh>
      <group ref={ref}>
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh position={[0.08 * s, (L / 2) * s, 0]}>
              <boxGeometry args={[0.02, L, 0.03]} />
              <meshStandardMaterial color="#bbb" metalness={0.8} />
            </mesh>
            <mesh position={[0.13 * s, L * s, 0]}>
              <boxGeometry args={[0.09, 0.02, 0.06]} />
              <meshStandardMaterial color="#222" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function Bear({ p }: { p: V3 }) {
  const fur = "#b07d56";
  return (
    <group position={p}>
      <mesh castShadow position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.16, 16, 14]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      <mesh castShadow position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.17, 18, 16]} />
        <meshStandardMaterial color={fur} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0.12 * s, 0.6, 0]}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshStandardMaterial color={fur} />
          </mesh>
          <mesh position={[0.06 * s, 0.48, 0.15]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          <mesh position={[0.14 * s, 0.22, 0.12]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={fur} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.42, 0.15]} scale={[1, 0.8, 0.7]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshStandardMaterial color="#f1d3b3" />
      </mesh>
      <mesh position={[0, 0.44, 0.2]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

/** 액세서리·펫 위치 계산 후 그리기 */
function Extras({ spec, equip, anim }: { spec: BikeSpec; equip?: Equipped; anim: AnimState }) {
  const acc = equip?.acc;
  const pet = equip?.pet;
  if (!acc && !pet) return null;
  const r = spec.wheel;
  const seat: V3 = [0, spec.seat[0], spec.seat[1]];
  const bar: V3 | null = spec.bar ? [0, spec.bar[0], spec.bar[1]] : null;
  const front: V3 = bar ? [0, bar[1] - 0.06, bar[2] + 0.1] : [0, seat[1] - 0.12, 0.16];
  const flagBase: V3 =
    spec.id === "unicycle" ? [0.06, seat[1] - 0.1, -0.12]
    : spec.id === "tricycle" ? [0.25, 0.28, -spec.base / 2 - 0.05]
    : [0.08, r, -spec.base / 2];
  let petAt: V3;
  let rack = false;
  if (spec.id === "unicycle") petAt = [0, seat[1] + 1.22, -0.02];
  else if (spec.id === "tandem") petAt = [0, bar![1] - 0.02, bar![2] + 0.16];
  else if (spec.id === "tricycle") petAt = [0, 0.29, -spec.base / 2 - 0.05];
  else {
    petAt = [0, r * 2 + 0.04, -spec.base / 2 - 0.02];
    rack = true;
  }
  return (
    <group>
      {acc === "acc_flag" && <Flag base={flagBase} />}
      {acc === "acc_light" && <HeadLight at={front} />}
      {acc === "acc_balloon" && <Balloon from={bar ? [0.22, bar[1], bar[2]] : [0.3, seat[1] + 0.3, 0]} />}
      {pet && rack && (
        <group>
          <mesh position={[0, r * 2 + 0.02, -spec.base / 2 + 0.04]} castShadow>
            <boxGeometry args={[0.16, 0.025, 0.3]} />
            <meshStandardMaterial color="#555" metalness={0.6} />
          </mesh>
          {[-1, 1].map((sx) => (
            <Tube key={sx} a={[sx * 0.07, r * 2 + 0.01, -spec.base / 2 + 0.12]} b={[sx * 0.06, r, -spec.base / 2]} r={0.01} color="#555" />
          ))}
        </group>
      )}
      {pet && <Pet kind={pet} at={petAt} anim={anim} />}
    </group>
  );
}

export function Bike({ spec, anim, equip }: { spec: BikeSpec; anim: AnimState; equip?: Equipped }) {
  const frameMat = useItemMaterial(item(equip, "paint"), spec.frame, { metalness: 0.3, roughness: 0.4 });
  const rimItem = item(equip, "rim");
  const rimMatRaw = useItemMaterial(rimItem, spec.accent, { metalness: 0.6, roughness: 0.3 });
  const rimMat = rimItem ? rimMatRaw : undefined;
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const rearSmallRefs = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const a = anim.dist / spec.wheel;
    for (const w of wheelRefs.current) if (w) w.rotation.x = a;
    if (spec.id === "tricycle") {
      const a2 = anim.dist / 0.18;
      for (const w of rearSmallRefs.current) if (w) w.rotation.x = a2;
    }
  });

  const r = spec.wheel;
  const frame = spec.frame;
  const seat: V3 = [0, spec.seat[0], spec.seat[1]];
  const bb: V3 = [0, spec.bb[0], spec.bb[1]];

  if (spec.id === "unicycle") {
    const crown: V3 = [0, r + 0.42, 0];
    return (
      <group>
        <Wheel ref={(el) => { wheelRefs.current[0] = el; }} r={r} tire={spec.tire} rim={spec.accent} rimMat={rimMat} position={[0, r, 0]} spokes={12} />
        <Tube a={[-0.06, r, 0]} b={off(crown, -0.06)} r={0.02} color={frame} mat={frameMat} />
        <Tube a={[0.06, r, 0]} b={off(crown, 0.06)} r={0.02} color={frame} mat={frameMat} />
        <Tube a={off(crown, -0.07)} b={off(crown, 0.07)} r={0.025} color={frame} mat={frameMat} />
        <Tube a={crown} b={[0, seat[1] - 0.04, 0]} r={0.022} color="#ccc" metalness={0.8} />
        <Saddle p={seat} color={spec.accent} />
        <Crank spec={spec} at={[0, r, 0]} anim={anim} color={frame} />
        <Extras spec={spec} equip={equip} anim={anim} />
      </group>
    );
  }

  if (spec.id === "tricycle") {
    const front: V3 = [0, r, spec.base / 2];
    const bar: V3 = [0, spec.bar![0], spec.bar![1]];
    const head: V3 = [0, bar[1] - 0.12, bar[2] + 0.01];
    const rearY = 0.18;
    const rearZ = -spec.base / 2;
    return (
      <group>
        <Wheel ref={(el) => { wheelRefs.current[0] = el; }} r={r} tire={spec.tire} rim="#fff" rimMat={rimMat} position={front} spokes={6} />
        {[-1, 1].map((s, i) => (
          <Wheel key={s} ref={(el) => { rearSmallRefs.current[i] = el; }} r={0.18} tire={0.045} rim="#fff" position={[0.34 * s, rearY, rearZ]} spokes={5} />
        ))}
        <Tube a={[-0.05, r, front[2]]} b={off(head, -0.05)} r={0.022} color={frame} mat={frameMat} />
        <Tube a={[0.05, r, front[2]]} b={off(head, 0.05)} r={0.022} color={frame} mat={frameMat} />
        <Tube a={head} b={bar} r={0.025} color={frame} mat={frameMat} />
        <Tube a={lerp3(front, head, 0.7)} b={[0, 0.38, -0.1]} r={0.035} color={frame} mat={frameMat} />
        <Tube a={[0, 0.38, -0.1]} b={[0, rearY + 0.04, rearZ]} r={0.035} color={frame} mat={frameMat} />
        <Tube a={[-0.36, rearY, rearZ]} b={[0.36, rearY, rearZ]} r={0.025} color={frame} mat={frameMat} />
        <Tube a={[0, 0.38, -0.1]} b={[0, seat[1] - 0.04, seat[2]]} r={0.03} color={frame} mat={frameMat} />
        <mesh position={[0, rearY + 0.08, rearZ - 0.05]} castShadow>
          <boxGeometry args={[0.55, 0.03, 0.22]} />
          <meshStandardMaterial color={spec.accent} />
        </mesh>
        <Saddle p={seat} color={spec.accent} />
        <Handlebar spec={spec} p={bar} />
        <Crank spec={spec} at={front} anim={anim} color={frame} />
        <Extras spec={spec} equip={equip} anim={anim} />
      </group>
    );
  }

  const rear: V3 = [0, r, -spec.base / 2];
  const front: V3 = [0, r, spec.base / 2];
  const bar: V3 = [0, spec.bar![0], spec.bar![1]];
  const stemTop: V3 = [0, bar[1] - 0.04, bar[2] - 0.02];
  const headLow = lerp3(front, stemTop, 0.5);
  const headTop = lerp3(front, stemTop, 0.82);
  const seatTop: V3 = [0, seat[1] - 0.05, seat[2]];
  const stepThrough = spec.id === "cruiser" || spec.id === "minivelo";
  const thick = spec.id === "mtb" || spec.id === "bmx" ? 0.03 : 0.024;
  const forkColor = spec.id === "mtb" ? "#f4a261" : frame;
  const tandem = spec.id === "tandem";

  // 탠덤: 뒷좌석(스토커)
  const seat2: V3 = [0, 0.95, -0.6];
  const bb2: V3 = [0, 0.32, -0.5];

  return (
    <group>
      <Wheel ref={(el) => { wheelRefs.current[0] = el; }} r={r} tire={spec.tire} rim={spec.accent} rimMat={rimMat} position={rear} deep={spec.id === "fixie"} whitewall={spec.id === "cruiser"} spokes={spec.id === "fixie" ? 3 : 10} />
      <Wheel ref={(el) => { wheelRefs.current[1] = el; }} r={r} tire={spec.tire} rim={spec.accent} rimMat={rimMat} position={front} deep={spec.id === "fixie"} whitewall={spec.id === "cruiser"} spokes={spec.id === "fixie" ? 3 : 10} />

      {/* 포크 / 헤드 / 스템 */}
      <Tube a={[-0.05, r, front[2]]} b={off(headLow, -0.04)} r={spec.id === "mtb" ? 0.03 : 0.018} color={forkColor} />
      <Tube a={[0.05, r, front[2]]} b={off(headLow, 0.04)} r={spec.id === "mtb" ? 0.03 : 0.018} color={forkColor} />
      <Tube a={headLow} b={headTop} r={0.035} color={frame} mat={frameMat} />
      <Tube a={headTop} b={stemTop} r={0.02} color="#ccc" metalness={0.8} />

      {/* 메인 삼각형 */}
      <Tube a={bb} b={seatTop} r={thick} color={frame} mat={frameMat} />
      {stepThrough ? (
        <Tube a={lerp3(bb, seatTop, 0.35)} b={lerp3(headLow, headTop, 0.2)} r={thick} color={frame} mat={frameMat} />
      ) : (
        <Tube a={lerp3(bb, seatTop, 0.85)} b={headTop} r={thick} color={frame} mat={frameMat} />
      )}
      <Tube a={bb} b={headLow} r={thick * 1.15} color={frame} mat={frameMat} />
      <Tube a={off(bb, -0.04)} b={off(rear, -0.05)} r={0.014} color={frame} mat={frameMat} />
      <Tube a={off(bb, 0.04)} b={off(rear, 0.05)} r={0.014} color={frame} mat={frameMat} />
      <Tube a={off(lerp3(bb, seatTop, 0.8), -0.03)} b={off(rear, -0.05)} r={0.013} color={frame} mat={frameMat} />
      <Tube a={off(lerp3(bb, seatTop, 0.8), 0.03)} b={off(rear, 0.05)} r={0.013} color={frame} mat={frameMat} />

      {tandem && (
        <>
          <Tube a={bb} b={bb2} r={thick} color={frame} mat={frameMat} />
          <Tube a={bb2} b={[0, seat2[1] - 0.05, seat2[2]]} r={thick} color={frame} mat={frameMat} />
          <Tube a={[0, seat2[1] - 0.12, seat2[2]]} b={lerp3(bb, seatTop, 0.85)} r={thick} color={frame} mat={frameMat} />
          <Tube a={[0, seat2[1] - 0.12, seat2[2]]} b={[0, 0.9, -0.25]} r={0.018} color="#ccc" />
          <Tube a={[-0.18, 0.9, -0.25]} b={[0.18, 0.9, -0.25]} r={0.016} color="#ccc" />
          <Saddle p={seat2} color={spec.accent} />
          <Crank spec={spec} at={bb2} anim={anim} color={frame} />
          <Bear p={[0, seat2[1] + 0.02, seat2[2]]} />
        </>
      )}

      {/* 크루저: 펜더와 바구니 */}
      {spec.id === "cruiser" && (
        <>
          {[rear, front].map((w, i) => (
            <mesh key={i} position={w} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[r + 0.03, 0.03, 6, 24, Math.PI * 0.9]} />
              <meshStandardMaterial color={spec.accent} />
            </mesh>
          ))}
          <mesh position={[0, bar[1] - 0.12, bar[2] + 0.22]} castShadow>
            <boxGeometry args={[0.36, 0.22, 0.26]} />
            <meshStandardMaterial color="#c8a165" roughness={1} />
          </mesh>
          <mesh position={[0, bar[1] - 0.0, bar[2] + 0.22]}>
            <sphereGeometry args={[0.07, 10, 8]} />
            <meshStandardMaterial color="#ff4d6d" />
          </mesh>
        </>
      )}

      <Tube a={seatTop} b={[0, seat[1] - 0.02, seat[2]]} r={0.016} color="#ccc" metalness={0.8} />
      <Saddle p={seat} color={spec.id === "cruiser" ? "#8d5524" : "#2b2b2b"} />
      <Handlebar spec={spec} p={bar} />
      <Crank spec={spec} at={bb} anim={anim} color={frame} />
      <Extras spec={spec} equip={equip} anim={anim} />
    </group>
  );
}
