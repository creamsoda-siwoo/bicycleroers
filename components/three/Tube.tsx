"use client";

import { useMemo } from "react";
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

type V3 = [number, number, number];

/** 두 점을 잇는 원기둥 (자전거 프레임용) */
export function Tube({
  a,
  b,
  r = 0.025,
  color,
  metalness = 0.3,
}: {
  a: V3;
  b: V3;
  r?: number;
  color: string;
  metalness?: number;
}) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const pos = va.add(vb).multiplyScalar(0.5);
    return { pos, quat, len };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.join(","), b.join(",")]);

  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r, r, len, 10]} />
      <meshStandardMaterial color={color} metalness={metalness} roughness={0.4} />
    </mesh>
  );
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();

/** 매 프레임 움직이는 팔/다리: 높이 1짜리 원기둥 메시를 a→b에 맞춤 */
export function placeLimb(mesh: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3) {
  if (!mesh) return;
  tmpA.copy(b).sub(a);
  const len = Math.max(tmpA.length(), 0.001);
  mesh.position.copy(tmpB.copy(a).add(b).multiplyScalar(0.5));
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(UP, tmpA.divideScalar(len));
}
