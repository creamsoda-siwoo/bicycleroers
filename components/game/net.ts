"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ChatMsg } from "@/lib/supabase";
import type { EmoteId, Profile, TrickId } from "@/lib/profile";
import { newAnim, now, type AnimState } from "../three/anim";

export interface NetPlayer extends Profile {
  id: string;
}

export interface MovePayload {
  id: string;
  x: number;
  y: number;
  z: number;
  h: number;
  s: number;
  l: number;
}

export interface Remote {
  target: { x: number; y: number; z: number; h: number };
  cur: { x: number; y: number; z: number; h: number };
  anim: AnimState;
  seen: boolean;
  lastAt: number;
}

export interface Bubble {
  text: string;
  at: number;
}

const CHANNEL = "bicycleroers-world";

export function useNet(profile: Profile, myId: string, onBell?: (id: string) => void) {
  const bellRef = useRef(onBell);
  bellRef.current = onBell;
  const remotes = useRef(new Map<string, Remote>());
  const [players, setPlayers] = useState<NetPlayer[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, Bubble>>({});
  const [connected, setConnected] = useState(false);
  const chRef = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);

  const ensure = (id: string): Remote => {
    let r = remotes.current.get(id);
    if (!r) {
      r = {
        target: { x: 0, y: 0, z: 0, h: 0 },
        cur: { x: 0, y: 0, z: 0, h: 0 },
        anim: newAnim(),
        seen: false,
        lastAt: 0,
      };
      remotes.current.set(id, r);
    }
    return r;
  };

  const showBubble = useCallback((id: string, text: string) => {
    setBubbles((b) => ({ ...b, [id]: { text, at: Date.now() } }));
  }, []);

  useEffect(() => {
    const topic = profile.map && profile.map !== "village" ? `${CHANNEL}-${profile.map}` : CHANNEL;
    const ch = supabase.channel(topic, {
      config: { presence: { key: myId }, broadcast: { self: false, ack: false } },
    });
    chRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<NetPlayer>();
      const list: NetPlayer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === myId || !metas[0]) continue;
        const m = metas[0];
        list.push({ id: key, nickname: m.nickname, color: m.color, hat: m.hat, bike: m.bike, equip: m.equip ?? {} });
        ensure(key);
      }
      for (const id of [...remotes.current.keys()]) {
        if (!list.some((p) => p.id === id)) remotes.current.delete(id);
      }
      setPlayers(list);
    });

    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      const p = payload as MovePayload;
      if (!p || p.id === myId) return;
      const r = ensure(p.id);
      r.target = { x: p.x, y: p.y, z: p.z, h: p.h };
      r.anim.speed = p.s;
      r.anim.lean = p.l;
      r.lastAt = now();
      if (!r.seen) {
        r.cur = { ...r.target };
        r.seen = true;
      }
    });

    ch.on("broadcast", { event: "emote" }, ({ payload }) => {
      const p = payload as { id: string; emote: EmoteId };
      const r = ensure(p.id);
      r.anim.emote = p.emote;
      r.anim.emoteAt = now();
    });

    ch.on("broadcast", { event: "trick" }, ({ payload }) => {
      const p = payload as { id: string; trick: TrickId | "crash" };
      const r = ensure(p.id);
      if (p.trick === "crash") {
        r.anim.crashAt = now();
        r.anim.trick = null;
      } else {
        r.anim.trick = p.trick;
        r.anim.trickAt = now();
      }
    });

    ch.on("broadcast", { event: "bell" }, ({ payload }) => {
      const p = payload as { id: string };
      showBubble(p.id, "🔔 따릉따릉!");
      bellRef.current?.(p.id);
    });

    ch.on("broadcast", { event: "bubble" }, ({ payload }) => {
      const p = payload as { id: string; text: string };
      showBubble(p.id, p.text);
    });

    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "bike_chat" },
      (payload) => {
        const m = payload.new as ChatMsg;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-59), m]));
      },
    );

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        ready.current = true;
        setConnected(true);
        await ch.track({ id: myId, nickname: profile.nickname, color: profile.color, hat: profile.hat, bike: profile.bike, equip: profile.equip ?? {} });
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        ready.current = false;
        setConnected(false);
      }
    });

    supabase
      .from("bike_chat")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data }) => {
        if (data) setMessages((prev) => {
          const old = (data as ChatMsg[]).reverse();
          const ids = new Set(old.map((m) => m.id));
          return [...old, ...prev.filter((m) => !ids.has(m.id))];
        });
      });

    return () => {
      ready.current = false;
      supabase.removeChannel(ch);
      chRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const sendMove = useCallback((p: MovePayload) => {
    if (!ready.current || !chRef.current) return;
    chRef.current.send({ type: "broadcast", event: "move", payload: p });
  }, []);

  const sendEmote = useCallback((emote: EmoteId) => {
    if (!ready.current || !chRef.current) return;
    chRef.current.send({ type: "broadcast", event: "emote", payload: { id: myId, emote } });
  }, [myId]);

  const sendTrick = useCallback((trick: TrickId | "crash") => {
    if (!ready.current || !chRef.current) return;
    chRef.current.send({ type: "broadcast", event: "trick", payload: { id: myId, trick } });
  }, [myId]);

  const sendBell = useCallback(() => {
    showBubble(myId, "🔔 따릉따릉!");
    if (!ready.current || !chRef.current) return;
    chRef.current.send({ type: "broadcast", event: "bell", payload: { id: myId } });
  }, [myId, showBubble]);

  const sendChat = useCallback(async (text: string) => {
    const message = text.trim().slice(0, 200);
    if (!message) return;
    showBubble(myId, message);
    if (ready.current && chRef.current) {
      chRef.current.send({ type: "broadcast", event: "bubble", payload: { id: myId, text: message } });
    }
    await supabase.from("bike_chat").insert({
      nickname: profile.nickname,
      bike: profile.bike,
      color: profile.color,
      message,
    });
  }, [myId, profile, showBubble]);

  return { remotes, players, messages, bubbles, connected, sendMove, sendEmote, sendTrick, sendBell, sendChat };
}
