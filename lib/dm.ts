// 💬 1:1 대화
import { supabase } from "./supabase";
import { myCred } from "./player";
import { cleanText } from "./filter";

export interface DM {
  id: number;
  from: string;
  to: string;
  message: string;
  at: string;
  read_at?: string | null;
}

export interface DMThread {
  id: string;
  nickname: string;
  last_at: string;
  last_message: string;
  unread: number;
}

function need() {
  const c = myCred();
  if (!c) throw new Error("내 기록 정보가 없어요");
  return c;
}

export async function dmSend(to: string, message: string): Promise<DM> {
  const { data, error } = await supabase.rpc("bike_dm_send", { ...need(), p_to: to, p_message: cleanText(message.trim()) });
  if (error) throw new Error(error.message);
  return data as DM;
}

export async function dmList(withId: string): Promise<DM[]> {
  const { data, error } = await supabase.rpc("bike_dm_list", { ...need(), p_with: withId, p_before: null });
  if (error) throw new Error(error.message);
  return ((data as DM[]) ?? []).map((m) => ({ ...m, message: cleanText(m.message) }));
}

export async function dmThreads(): Promise<DMThread[]> {
  const { data, error } = await supabase.rpc("bike_dm_threads", need());
  if (error) throw new Error(error.message);
  return ((data as DMThread[]) ?? []).map((t) => ({ ...t, nickname: cleanText(t.nickname ?? "알 수 없음"), last_message: cleanText(t.last_message ?? "") }));
}
