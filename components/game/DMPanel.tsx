"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dmList, dmSend, dmThreads, type DM, type DMThread } from "@/lib/dm";
import { cleanText, hasBanned } from "@/lib/filter";
import { sfx } from "@/lib/sound";

/** 1:1 대화 알림용 공용 채널 (메시지 내용은 보내지 않음) */
export function useDMNotify(myPid: string | undefined, onIncoming: (fromPid: string, fromName: string) => void) {
  const cb = useRef(onIncoming);
  cb.current = onIncoming;
  const ch = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!myPid) return;
    const c = supabase.channel("bicycleroers-dm", { config: { broadcast: { self: false } } });
    c.on("broadcast", { event: "dm" }, ({ payload }) => {
      const p = payload as { to: string; from: string; fromName: string };
      if (p?.to === myPid) cb.current(p.from, cleanText(String(p.fromName ?? "")));
    });
    c.subscribe();
    ch.current = c;
    return () => {
      supabase.removeChannel(c);
      ch.current = null;
    };
  }, [myPid]);
  return useCallback((to: string, fromName: string) => {
    ch.current?.send({ type: "broadcast", event: "dm", payload: { to, from: myPid, fromName } });
  }, [myPid]);
}

export default function DMPanel({
  myPid,
  myName,
  target,
  onClose,
  notify,
  bump,
}: {
  myPid: string;
  myName: string;
  /** 바로 열 대화 상대 (없으면 대화 목록) */
  target: { pid: string; nickname: string } | null;
  onClose: () => void;
  notify: (to: string, fromName: string) => void;
  /** 새 메시지가 오면 바뀌는 값 (다시 불러오기용) */
  bump: number;
}) {
  const [withWho, setWithWho] = useState(target);
  const [threads, setThreads] = useState<DMThread[] | null>(null);
  const [msgs, setMsgs] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => setWithWho(target), [target]);

  useEffect(() => {
    let alive = true;
    setErr("");
    if (withWho) {
      dmList(withWho.pid)
        .then((m) => alive && setMsgs(m))
        .catch((e) => alive && setErr((e as Error).message));
    } else {
      dmThreads()
        .then((t) => alive && setThreads(t))
        .catch((e) => alive && setErr((e as Error).message));
    }
    return () => {
      alive = false;
    };
  }, [withWho, bump]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs]);

  const send = async () => {
    const t = text.trim();
    if (!t || !withWho || sending) return;
    if (hasBanned(t)) {
      setErr("쓸 수 없는 말이 들어 있어서 ♡ 로 가려서 보낼게요");
    }
    setSending(true);
    try {
      const m = await dmSend(withWho.pid, t);
      setMsgs((old) => [...old, { ...m, message: cleanText(m.message) }]);
      setText("");
      notify(withWho.pid, myName);
      sfx("checkpoint");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  };

  return (
    <div className="dm panel">
      <div className="dm-head">
        {withWho ? (
          <>
            <button className="linkish" onClick={() => setWithWho(null)} aria-label="대화 목록">←</button>
            <b>💬 {cleanText(withWho.nickname)}</b>
          </>
        ) : (
          <b>📨 1:1 대화함</b>
        )}
        <button className="x" aria-label="닫기" onClick={onClose}>✕</button>
      </div>
      {withWho ? (
        <>
          <div className="dm-list" ref={list}>
            {msgs.length === 0 && <div className="muted">첫 메시지를 보내 보세요! 대화는 저장돼서 나중에도 볼 수 있어요.</div>}
            {msgs.map((m) => (
              <div key={m.id} className={m.from === myPid ? "dm-msg me" : "dm-msg"}>
                <span className="bubble-txt">{m.message}</span>
                <small>{fmt(m.at)}</small>
              </div>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input value={text} maxLength={300} placeholder="고운 말로 보내요 🙂" onChange={(e) => setText(e.target.value)} />
            <button className="btn small" type="submit" disabled={sending}>보내기</button>
          </form>
        </>
      ) : (
        <div className="dm-threads">
          {threads === null && !err && <div className="muted">불러오는 중…</div>}
          {threads?.length === 0 && <div className="muted">아직 대화가 없어요. 다른 라이더를 누르고 “💬 1:1 대화”를 눌러 보세요.</div>}
          {threads?.map((t) => (
            <button key={t.id} className="dm-thread" onClick={() => setWithWho({ pid: t.id, nickname: t.nickname })}>
              <b>{t.nickname}</b>
              <span className="muted">{t.last_message}</span>
              <small>{fmt(t.last_at)}</small>
              {t.unread > 0 && <span className="badge">{t.unread}</span>}
            </button>
          ))}
        </div>
      )}
      {err && <div className="dm-err">{err}</div>}
    </div>
  );
}
