"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CABINS, IGLOO, LAKE, LIFT, PEAK, PINES, SNOWMEN, SNOW_RAMPS, SNOW_SIZE, VILLAGE, terrain,
} from "@/lib/snow";

function Terrain() {
  const geo = useMemo(() => {
    const size = SNOW_SIZE * 2 + 120;
    const seg = 160;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrain(x, z);
      pos.setY(i, h);
      // 경사가 급하면 바위색, 아니면 눈
      const sl = Math.hypot(terrain(x + 1, z) - terrain(x - 1, z), terrain(x, z + 1) - terrain(x, z - 1)) / 2;
      const n = Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.02;
      if (sl > 0.75) c.set("#8d99ae");
      else c.setRGB(0.93 + n, 0.96 + n, 1);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function Pines() {
  return (
    <>
      {PINES.map((t, i) => {
        const y = terrain(t.x, t.z);
        return (
          <group key={i} position={[t.x, y, t.z]} scale={t.s}>
            <mesh position={[0, 0.5, 0]} castShadow>
              <cylinderGeometry args={[0.16, 0.22, 1, 6]} />
              <meshStandardMaterial color="#6b4423" />
            </mesh>
            {[0, 1, 2].map((k) => (
              <group key={k}>
                <mesh position={[0, 1.3 + k * 0.8, 0]} castShadow>
                  <coneGeometry args={[1.3 - k * 0.32, 1.3, 7]} />
                  <meshStandardMaterial color={i % 3 ? "#2d6a4f" : "#40916c"} flatShading />
                </mesh>
                <mesh position={[0, 1.55 + k * 0.8, 0]}>
                  <coneGeometry args={[(1.3 - k * 0.32) * 0.75, 0.55, 7]} />
                  <meshStandardMaterial color="#ffffff" flatShading />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}
    </>
  );
}

function Snowmen() {
  return (
    <>
      {SNOWMEN.map((m, i) => (
        <group key={i} position={[m.x, terrain(m.x, m.z), m.z]} scale={m.s} rotation={[0, i * 1.3, 0]}>
          <mesh position={[0, 0.55, 0]} castShadow>
            <sphereGeometry args={[0.6, 18, 14]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <sphereGeometry args={[0.42, 18, 14]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          <mesh position={[0, 1.95, 0]} castShadow>
            <sphereGeometry args={[0.3, 16, 12]} />
            <meshStandardMaterial color="#fff" />
          </mesh>
          <mesh position={[0, 1.95, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.05, 0.3, 8]} />
            <meshStandardMaterial color="#f77f00" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.1, 2.03, 0.26]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial color="#111" />
            </mesh>
          ))}
          <mesh position={[0, 2.22, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.3, 14]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 2.08, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.03, 16]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh position={[0, 1.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.3, 0.06, 8, 20]} />
            <meshStandardMaterial color="#e63946" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={`a${s}`} position={[s * 0.6, 1.45, 0]} rotation={[0, 0, s * -0.9]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 5]} />
              <meshStandardMaterial color="#6b4423" />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

function Smoke({ at }: { at: [number, number, number] }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    g.current?.children.forEach((c, i) => {
      const k = ((t * 0.4 + i / 5) % 1);
      c.position.set(Math.sin(t + i) * 0.3 * k, k * 3, 0);
      c.scale.setScalar(0.3 + k * 0.9);
      ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - k);
    });
  });
  return (
    <group ref={g} position={at}>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.4, 8, 6]} />
          <meshStandardMaterial color="#e9ecef" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Cabins() {
  return (
    <>
      {CABINS.map((c, i) => {
        const y = terrain(c.x, c.z);
        return (
          <group key={i} position={[c.x, y, c.z]} rotation={[0, c.rot, 0]}>
            <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
              <boxGeometry args={[5.5, 3.2, 4.5]} />
              <meshStandardMaterial color={c.c} />
            </mesh>
            {/* 눈 덮인 지붕 */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 1.45, 3.9, 0]} rotation={[0, 0, s * -0.65]} castShadow>
                <boxGeometry args={[3.6, 0.35, 5.2]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
            ))}
            <mesh position={[0, 1.1, 2.26]}>
              <planeGeometry args={[1, 2.1]} />
              <meshStandardMaterial color="#432818" />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={`w${s}`} position={[s * 1.6, 2, 2.26]}>
                <planeGeometry args={[0.9, 0.8]} />
                <meshStandardMaterial color="#ffd166" emissive="#ffb703" emissiveIntensity={1.2} />
              </mesh>
            ))}
            <mesh position={[1.4, 4.5, -1]}>
              <boxGeometry args={[0.6, 1.4, 0.6]} />
              <meshStandardMaterial color="#6c757d" />
            </mesh>
            <Smoke at={[1.4, 5.3, -1]} />
          </group>
        );
      })}
    </>
  );
}

function Igloo() {
  const y = terrain(IGLOO.x, IGLOO.z);
  return (
    <group position={[IGLOO.x, y, IGLOO.z]}>
      <mesh castShadow>
        <sphereGeometry args={[2.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f1faff" />
      </mesh>
      <mesh position={[0, 0.8, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 1.4, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color="#e3f2fd" side={THREE.DoubleSide} />
      </mesh>
      {[0.5, 1.1, 1.7].map((h) => (
        <mesh key={h} position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.sqrt(2.8 * 2.8 - h * h) + 0.01, 0.03, 4, 40]} />
          <meshStandardMaterial color="#cfe2f3" />
        </mesh>
      ))}
    </group>
  );
}

function Lake() {
  return (
    <group position={[LAKE.x, 0.03, LAKE.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[LAKE.rx, LAKE.rz, 1]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#a8dadc" metalness={0.4} roughness={0.05} />
      </mesh>
      {/* 얼음 금 */}
      {[0.4, 1.5, 2.6, 3.7, 4.9].map((a, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.cos(a) * 4, 0.01, -Math.sin(a) * 3]}>
          <planeGeometry args={[7, 0.06]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Ramps() {
  return (
    <>
      {SNOW_RAMPS.map((r, i) => {
        const shape = new THREE.Shape();
        shape.moveTo(-r.length / 2, -0.6);
        shape.lineTo(r.length / 2, -0.6);
        shape.lineTo(r.length / 2, r.height);
        shape.lineTo(-r.length / 2, 0);
        shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false });
        g.translate(0, 0, -r.width / 2);
        return (
          <group key={i} position={[r.x, terrain(r.x, r.z), r.z]} rotation={[0, r.rot, 0]}>
            <mesh geometry={g} castShadow receiveShadow>
              <meshStandardMaterial color={r.color} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** 리프트: 승강장 두 곳, 기둥, 줄, 움직이는 의자 */
function Lift() {
  const chairs = useRef<THREE.Group>(null);
  const a = LIFT.base;
  const b = LIFT.top;
  const ya = terrain(a.x, a.z) + 6;
  const yb = terrain(b.x, b.z) + 6;
  const len = Math.hypot(b.x - a.x, b.z - a.z, yb - ya);
  const dir = new THREE.Vector3(b.x - a.x, yb - ya, b.z - a.z).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(1.2);
  const cableQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const N = 10;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    chairs.current?.children.forEach((c, i) => {
      const up = i < N;
      const k = ((t * 0.03 + (i % N) / N) % 1);
      const f = up ? k : 1 - k;
      const off = up ? 1 : -1;
      c.position.set(
        a.x + (b.x - a.x) * f + side.x * off,
        ya + (yb - ya) * f - 1.2,
        a.z + (b.z - a.z) * f + side.z * off,
      );
    });
  });
  const towers = [0.2, 0.45, 0.7];
  return (
    <group>
      {[[a, ya], [b, yb]].map(([p, y], i) => {
        const pp = p as { x: number; z: number };
        const yy = (y as number) - 6;
        return (
          <group key={i} position={[pp.x, yy, pp.z]}>
            <mesh position={[0, 0.15, 0]} receiveShadow>
              <cylinderGeometry args={[2.6, 2.6, 0.3, 24]} />
              <meshStandardMaterial color={i ? "#ffb703" : "#06d6a0"} emissive={i ? "#ffb703" : "#06d6a0"} emissiveIntensity={0.4} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[side.x * s * 2.4, 3.2, side.z * s * 2.4]} castShadow>
                <boxGeometry args={[0.4, 6.4, 0.4]} />
                <meshStandardMaterial color="#495057" />
              </mesh>
            ))}
            <mesh position={[0, 6.6, 0]} castShadow>
              <boxGeometry args={[5.6, 0.5, 2.4]} />
              <meshStandardMaterial color="#d00000" />
            </mesh>
          </group>
        );
      })}
      {towers.map((k) => {
        const x = a.x + (b.x - a.x) * k;
        const z = a.z + (b.z - a.z) * k;
        const top = ya + (yb - ya) * k + 0.2;
        const g = terrain(x, z);
        return (
          <group key={k}>
            <mesh position={[x, (g + top) / 2, z]} castShadow>
              <cylinderGeometry args={[0.18, 0.25, top - g, 8]} />
              <meshStandardMaterial color="#6c757d" />
            </mesh>
            <mesh position={[x, top, z]}>
              <boxGeometry args={[3, 0.2, 0.3]} />
              <meshStandardMaterial color="#6c757d" />
            </mesh>
          </group>
        );
      })}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(a.x + b.x) / 2 + side.x * s, (ya + yb) / 2, (a.z + b.z) / 2 + side.z * s]} quaternion={cableQ}>
          <cylinderGeometry args={[0.03, 0.03, len, 4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      <group ref={chairs}>
        {Array.from({ length: N * 2 }).map((_, i) => (
          <group key={i}>
            <mesh position={[0, 0.6, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 1.2, 4]} />
              <meshStandardMaterial color="#222" />
            </mesh>
            <mesh>
              <boxGeometry args={[1.2, 0.12, 0.6]} />
              <meshStandardMaterial color={["#e63946", "#3a86ff", "#ffb703"][i % 3]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** 카메라 주변에 내리는 눈 */
function Snowfall() {
  const { camera } = useThree();
  const N = 1400;
  const ref = useRef<THREE.Points>(null);
  const { geo, speeds } = useMemo(() => {
    const p = new Float32Array(N * 3);
    const sp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      p[i * 3] = (Math.random() - 0.5) * 70;
      p[i * 3 + 1] = Math.random() * 30;
      p[i * 3 + 2] = (Math.random() - 0.5) * 70;
      sp[i] = 1 + Math.random() * 1.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return { geo: g, speeds: sp };
  }, []);
  useFrame(({ clock }, dt) => {
    const pts = ref.current;
    if (!pts) return;
    pts.position.set(Math.floor(camera.position.x), Math.floor(camera.position.y) - 10, Math.floor(camera.position.z));
    const arr = geo.attributes.position.array as Float32Array;
    const t = clock.getElapsedTime();
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 1] -= speeds[i] * Math.min(dt, 0.05);
      arr[i * 3] += Math.sin(t + i) * 0.01;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] += 30;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={0.18} transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

/** 하늘의 오로라 */
function Aurora() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const geos = useMemo(
    () =>
      [0, 1, 2].map((k) => {
        const g = new THREE.PlaneGeometry(260, 34, 80, 1);
        const pos = g.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          pos.setZ(i, Math.sin(x * 0.03 + k) * 18);
        }
        g.computeVertexNormals();
        return g;
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((m, i) => {
      if (!m) return;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(t * 0.5 + i * 2) * 0.08;
      m.position.x = Math.sin(t * 0.05 + i) * 10;
    });
  });
  const cols = ["#52ffb8", "#6df0ff", "#b388ff"];
  return (
    <group position={[0, 70, -170]}>
      {geos.map((g, i) => (
        <mesh key={i} ref={(el) => { refs.current[i] = el; }} geometry={g} position={[0, i * 12, i * 15]} rotation={[0.25, 0, 0]}>
          <meshBasicMaterial color={cols[i]} transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
        </mesh>
      ))}
    </group>
  );
}

function FarPeaks() {
  const list = useMemo(
    () => Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const r = SNOW_SIZE + 60 + (i % 3) * 15;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 45 + ((i * 7) % 5) * 10, w: 35 + (i % 4) * 6 };
    }),
    [],
  );
  return (
    <>
      {list.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]}>
          <mesh position={[0, m.h / 2, 0]}>
            <coneGeometry args={[m.w, m.h, 7]} />
            <meshStandardMaterial color="#adb5bd" flatShading />
          </mesh>
          <mesh position={[0, m.h * 0.78, 0]}>
            <coneGeometry args={[m.w * 0.45, m.h * 0.45, 7]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      ))}
    </>
  );
}

function VillageLights() {
  const pts = useMemo(
    () => Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return { x: VILLAGE.x + Math.cos(a) * 20, z: VILLAGE.z + Math.sin(a) * 20 };
    }),
    [],
  );
  return (
    <>
      {pts.map((p, i) => {
        const y = terrain(p.x, p.z);
        return (
          <group key={i} position={[p.x, y, p.z]}>
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 3.2, 6]} />
              <meshStandardMaterial color="#343a40" />
            </mesh>
            <mesh position={[0, 3.3, 0]}>
              <sphereGeometry args={[0.28, 10, 8]} />
              <meshStandardMaterial color="#fff3b0" emissive="#ffd166" emissiveIntensity={1.5} />
            </mesh>
          </group>
        );
      })}
      {/* 정상 표지 깃발 */}
      <group position={[PEAK.x, terrain(PEAK.x, PEAK.z), PEAK.z]}>
        <mesh position={[0, 2, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 4, 6]} />
          <meshStandardMaterial color="#ddd" />
        </mesh>
        <mesh position={[0.6, 3.6, 0]}>
          <boxGeometry args={[1.2, 0.7, 0.04]} />
          <meshStandardMaterial color="#e63946" emissive="#e63946" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </>
  );
}

export function SnowWorld() {
  return (
    <group>
      <Terrain />
      <Lake />
      <Ramps />
      <Pines />
      <Snowmen />
      <Cabins />
      <Igloo />
      <Lift />
      <VillageLights />
      <FarPeaks />
      <Snowfall />
      <Aurora />
    </group>
  );
}
