import { supabase } from "./supabase";
import type { Equipped } from "./shop";

export interface PlayerData {
  id: string;
  nickname: string;
  stars: number;
  stars_earned: number;
  total_distance: number;
  total_trick: number;
  best_trick: number;
  best_distance: number;
  rides: number;
  owned: string[];
  equipped: Equipped;
  /** 기록 지키기 이름 (등록했으면) */
  account?: string | null;
}

const KEY = "bicycleroers-player";

interface Cred {
  id: string;
  token: string;
}

function loadCred(): Cred | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cred;
    return c.id && c.token ? c : null;
  } catch {
    return null;
  }
}

function saveCred(c: Cred) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* 저장 불가 */
  }
}

function strip(d: PlayerData & { token?: string }): PlayerData {
  const { token: _t, ...rest } = d;
  void _t;
  return { ...rest, equipped: rest.equipped ?? {}, owned: rest.owned ?? [] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 저장된 플레이어를 불러오고, 없을 때만 새로 만듦.
 * 네트워크 오류로 불러오기에 실패해도 기존 기록 연결을 절대 덮어쓰지 않음.
 */
export async function ensurePlayer(nickname: string): Promise<PlayerData> {
  const c = loadCred();
  if (c) {
    let lastErr = "";
    for (let i = 0; i < 4; i++) {
      const { data, error } = await supabase.rpc("bike_player_get", { p_id: c.id, p_token: c.token });
      if (!error && data) return strip(data as PlayerData);
      lastErr = error?.message ?? "불러오기 실패";
      if (lastErr.includes("invalid player")) break; // 토큰이 정말 틀린 경우만 새로 만듦
      await sleep(600 * (i + 1));
    }
    if (!lastErr.includes("invalid player")) throw new Error(`기록을 불러오지 못했어요 (${lastErr}). 잠시 후 다시 시도해 주세요`);
    // 혹시 모를 복구를 위해 이전 연결 정보 보관
    try {
      localStorage.setItem(`${KEY}-old-${Date.now()}`, JSON.stringify(c));
    } catch {
      /* 무시 */
    }
  }
  const { data, error } = await supabase.rpc("bike_player_create", { p_nickname: nickname || "라이더" });
  if (error || !data) throw new Error(error?.message ?? "플레이어 생성 실패");
  const d = data as PlayerData & { token: string };
  saveCred({ id: d.id, token: d.token });
  return strip(d);
}

/** 🔐 이름 + 비밀번호 등록 */
export async function setAccount(name: string, pass: string): Promise<PlayerData> {
  const c = cred();
  const { data, error } = await supabase.rpc("bike_account_set", { p_id: c.id, p_token: c.token, p_name: name, p_pass: pass });
  if (error) throw new Error(error.message);
  return strip(data as PlayerData);
}

/** 🔐 이름 + 비밀번호로 기록 불러오기 (이 기기에 연결) */
export async function loginAccount(name: string, pass: string): Promise<PlayerData> {
  const { data, error } = await supabase.rpc("bike_account_login", { p_name: name, p_pass: pass });
  if (error) throw new Error(error.message);
  const d = data as PlayerData & { token?: string; error?: string };
  if (d.error) throw new Error(d.error);
  if (!d.token) throw new Error("불러오기 실패");
  const old = loadCred();
  if (old && old.id !== d.id) {
    try {
      localStorage.setItem(`${KEY}-old-${Date.now()}`, JSON.stringify(old));
    } catch {
      /* 무시 */
    }
  }
  saveCred({ id: d.id, token: d.token });
  return strip(d);
}

/** 서버 함수 호출용 내 id/토큰 */
export function myCred(): { p_id: string; p_token: string } | null {
  const c = loadCred();
  return c ? { p_id: c.id, p_token: c.token } : null;
}

function cred(): Cred {
  const c = loadCred();
  if (!c) throw new Error("플레이어 정보가 없어요");
  return c;
}

export async function buyItem(itemId: string): Promise<PlayerData> {
  const c = cred();
  const { data, error } = await supabase.rpc("bike_buy", { p_id: c.id, p_token: c.token, p_item: itemId });
  if (error) throw new Error(error.message);
  return strip(data as PlayerData);
}

export async function giftStars(toPid: string, amount: number): Promise<PlayerData> {
  const c = cred();
  const { data, error } = await supabase.rpc("bike_gift", { p_id: c.id, p_token: c.token, p_to: toPid, p_amount: amount });
  if (error) throw new Error(error.message);
  return strip(data as PlayerData);
}

export async function equipItem(slot: string, itemId: string | null): Promise<PlayerData> {
  const c = cred();
  const { data, error } = await supabase.rpc("bike_equip", { p_id: c.id, p_token: c.token, p_slot: slot, p_item: itemId });
  if (error) throw new Error(error.message);
  return strip(data as PlayerData);
}

export interface ProgressDelta {
  nickname: string;
  distance: number;
  stars: number;
  trick: number;
  bestTrick: number;
  bestDistance: number;
  finished: boolean;
}

function progressArgs(c: Cred, d: ProgressDelta) {
  return {
    p_id: c.id,
    p_token: c.token,
    p_nickname: d.nickname,
    p_distance: Math.max(0, Math.round(d.distance)),
    p_stars: Math.max(0, Math.round(d.stars)),
    p_trick: Math.max(0, Math.round(d.trick)),
    p_best_trick: Math.max(0, Math.round(d.bestTrick)),
    p_best_distance: Math.max(0, Math.round(d.bestDistance)),
    p_finished: d.finished,
  };
}

export async function saveProgress(d: ProgressDelta): Promise<PlayerData | null> {
  const c = loadCred();
  if (!c) return null;
  const { data, error } = await supabase.rpc("bike_player_progress", progressArgs(c, d));
  if (error) return null;
  return strip(data as PlayerData);
}

/** 탭을 닫을 때도 전송되도록 keepalive 요청 */
export function saveProgressOnExit(d: ProgressDelta) {
  const c = loadCred();
  if (!c) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ekdisahabshzffvfytft.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_sDVBKQvkD_-eJqMtEV1cWw_uai1eNXo";
  try {
    fetch(`${url}/rest/v1/rpc/bike_player_progress`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(progressArgs(c, d)),
    });
  } catch {
    /* 무시 */
  }
}

/** 다른 기기에서 이어하기용 코드 */
export function exportCode(): string | null {
  const c = loadCred();
  return c ? `${c.id}.${c.token}` : null;
}

export async function importCode(code: string): Promise<PlayerData> {
  const [id, token] = code.trim().split(".");
  if (!id || !token) throw new Error("코드 형식이 올바르지 않아요");
  const { data, error } = await supabase.rpc("bike_player_get", { p_id: id, p_token: token });
  if (error || !data) throw new Error("코드가 맞지 않아요");
  saveCred({ id, token });
  return strip(data as PlayerData);
}
