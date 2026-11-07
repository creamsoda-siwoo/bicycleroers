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

/** 저장된 플레이어를 불러오고, 없으면 새로 만듦 */
export async function ensurePlayer(nickname: string): Promise<PlayerData> {
  const c = loadCred();
  if (c) {
    const { data, error } = await supabase.rpc("bike_player_get", { p_id: c.id, p_token: c.token });
    if (!error && data) return strip(data as PlayerData);
  }
  const { data, error } = await supabase.rpc("bike_player_create", { p_nickname: nickname || "라이더" });
  if (error || !data) throw new Error(error?.message ?? "플레이어 생성 실패");
  const d = data as PlayerData & { token: string };
  saveCred({ id: d.id, token: d.token });
  return strip(d);
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
