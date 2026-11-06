import { createClient } from "@supabase/supabase-js";

// yahomi 프로젝트 (공개용 publishable key — 브라우저에 노출되어도 안전, RLS로 보호)
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ekdisahabshzffvfytft.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_sDVBKQvkD_-eJqMtEV1cWw_uai1eNXo";

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

export interface ChatMsg {
  id: number;
  nickname: string;
  bike: string;
  color: string;
  message: string;
  created_at: string;
}

export interface RideRecord {
  id: number;
  nickname: string;
  bike: string;
  distance: number;
  stars: number;
  created_at: string;
}
