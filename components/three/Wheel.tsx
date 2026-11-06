"use client";

import { forwardRef } from "react";
import * as THREE from "three";

interface WheelProps {
  r: number;
  tire: number;
  rim: string;
  position: [number, number, number];
  deep?: boolean;
  spokes?: number;
  whitewall?: boolean;
  rimMat?: THREE.Material;
}

/** 바퀴: x축으로 굴러감 (진행방향 +z) */
export const Wheel = forwardRef<THREE.Group, WheelProps>(function Wheel(
  { r, tire, rim, position, deep, spokes = 8, whitewall, rimMat },
  ref,
) {
  const inner = r - tire;
  return (
    <group position={position}>
      <group ref={ref}>
        {/* 타이어 */}
        <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[inner, tire, 10, 36]} />
          <meshStandardMaterial color="#222" roughness={0.9} />
        </mesh>
        {whitewall && (
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[inner - tire * 0.4, tire * 0.55, 8, 36]} />
            <meshStandardMaterial color="#f5f5f5" />
          </mesh>
        )}
        {/* 림 */}
        {deep ? (
          <mesh rotation={[0, 0, Math.PI / 2]} material={rimMat}>
            <cylinderGeometry args={[inner - tire * 0.3, inner - tire * 0.3, 0.03, 32, 1, true]} />
            {!rimMat && <meshStandardMaterial color={rim} side={THREE.DoubleSide} />}
          </mesh>
        ) : (
          <mesh rotation={[0, Math.PI / 2, 0]} material={rimMat}>
            <torusGeometry args={[inner - tire * 0.6, rimMat ? 0.022 : 0.012, 6, 36]} />
            {!rimMat && <meshStandardMaterial color={rim} metalness={0.6} roughness={0.3} />}
          </mesh>
        )}
        {/* 바퀴살 */}
        {Array.from({ length: spokes }).map((_, i) => (
          <mesh key={i} rotation={[(i / spokes) * Math.PI, 0, 0]}>
            <boxGeometry args={[0.006, (inner - tire * 0.5) * 2, 0.006]} />
            <meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        {/* 허브 */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 12]} />
          <meshStandardMaterial color="#888" metalness={0.7} />
        </mesh>
        {deep && (
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[inner - tire * 0.3, inner - tire * 0.3, 0.028, 32]} />
            <meshStandardMaterial color={rim} transparent opacity={0.35} />
          </mesh>
        )}
      </group>
    </group>
  );
});
