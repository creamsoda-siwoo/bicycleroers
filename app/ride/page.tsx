"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/game/Game"), {
  ssr: false,
  loading: () => <div className="loading">마을로 가는 중… 🚲</div>,
});

export default function RidePage() {
  return <Game />;
}
