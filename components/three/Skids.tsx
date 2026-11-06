"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX = 260;
const LIFE = 7;

/** 스키드 자국 버퍼 — Player 가 추가하고 Skids 컴포넌트가 그림 */
export const skidBuf = {
  items: Array.from({ length: MAX }, () => ({ x: 0, y: -100, z: 0, h: 0, born: -100, w: 0.12 })),
  next: 0,
};

export function addSkid(x: number, y: number, z: number, h: number, w = 0.12) {
  const it = skidBuf.items[skidBuf.next];
  skidBuf.next = (skidBuf.next + 1) % MAX;
  it.x = x;
  it.y = y;
  it.z = z;
  it.h = h;
  it.w = w;
  it.born = performance.now() / 1000;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const pos = new THREE.Vector3();
const sc = new THREE.Vector3();
const col = new THREE.Color();

export function Skids({ dark = "#2b2b2b" }: { dark?: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 0.55);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const now = performance.now() / 1000;
    for (let i = 0; i < MAX; i++) {
      const it = skidBuf.items[i];
      const age = now - it.born;
      const k = age < LIFE ? 1 - age / LIFE : 0;
      e.set(0, it.h, 0);
      q.setFromEuler(e);
      pos.set(it.x, it.y + 0.03, it.z);
      sc.set(k > 0 ? it.w / 0.12 * 0.12 : 0, 1, k > 0 ? 1 : 0);
      m4.compose(pos, q, sc);
      m.setMatrixAt(i, m4);
      col.set(dark).lerp(new THREE.Color("#888888"), 1 - k);
      m.setColorAt(i, col);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, MAX]} frustumCulled={false}>
      <meshBasicMaterial transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </instancedMesh>
  );
}
