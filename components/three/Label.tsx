"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const v = new THREE.Vector3();

/** 3D 위치를 따라다니는 HTML 이름표/말풍선 (DOM 직접 관리) */
export function Label({
  y,
  name,
  bubble,
  me,
}: {
  y: number;
  name?: string;
  bubble?: string | null;
  me?: boolean;
}) {
  const anchor = useRef<THREE.Object3D>(null);
  const { gl, camera, size } = useThree();
  const el = useRef<{ root: HTMLDivElement; name: HTMLDivElement; bubble: HTMLDivElement } | null>(null);

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const root = document.createElement("div");
    root.className = "label3d";
    const wrap = document.createElement("div");
    wrap.className = "tag-wrap";
    const b = document.createElement("div");
    b.className = "bubble";
    const n = document.createElement("div");
    n.className = me ? "nametag me" : "nametag";
    wrap.append(b, n);
    root.append(wrap);
    parent.append(root);
    el.current = { root, name: n, bubble: b };
    return () => {
      root.remove();
      el.current = null;
    };
  }, [gl, me]);

  useEffect(() => {
    const e = el.current;
    if (!e) return;
    e.name.textContent = name ?? "";
    e.name.style.display = name ? "" : "none";
    e.bubble.textContent = bubble ?? "";
    e.bubble.style.display = bubble ? "" : "none";
    if (bubble) {
      // 팝 애니메이션 재시작
      e.bubble.style.animation = "none";
      void e.bubble.offsetWidth;
      e.bubble.style.animation = "";
    }
  }, [name, bubble, me]);

  useFrame(() => {
    const e = el.current;
    const a = anchor.current;
    if (!e || !a) return;
    a.getWorldPosition(v);
    const dist = v.distanceTo(camera.position);
    v.project(camera);
    let shown = true;
    for (let o: THREE.Object3D | null = a; o; o = o.parent) if (!o.visible) shown = false;
    const hidden = v.z > 1 || dist > 70 || !shown;
    if (hidden) {
      e.root.style.display = "none";
      return;
    }
    const x = (v.x * 0.5 + 0.5) * size.width;
    const yy = (-v.y * 0.5 + 0.5) * size.height;
    const s = Math.max(0.55, Math.min(1.15, 9 / dist));
    e.root.style.display = "";
    e.root.style.transform = `translate3d(${x}px, ${yy}px, 0) translate(-50%, -100%) scale(${s})`;
    e.root.style.zIndex = String(1000 - Math.round(dist));
  });

  return <object3D ref={anchor} position={[0, y, 0]} />;
}
