-- 부정 표현 차단 + 1:1 대화 (yahomi)

create table if not exists public.bike_banned_words (word text primary key);
alter table public.bike_banned_words enable row level security;
create policy "bike_banned_words read" on public.bike_banned_words for select to anon, authenticated using (true);

insert into public.bike_banned_words (word) values
 ('씨발'),('시발'),('씨바'),('시바'),('씨빨'),('씨팔'),('시팔'),('ㅅㅂ'),('ㅆㅂ'),('ㅆㅃ'),('씹'),('좆'),('좇'),('존나'),('졸라'),('ㅈㄴ'),
 ('병신'),('븅신'),('빙신'),('ㅂㅅ'),('개새끼'),('개새기'),('개색기'),('개색히'),('새끼'),('색히'),('ㅅㄲ'),('개년'),('개놈'),
 ('미친놈'),('미친년'),('미친새'),('ㅁㅊ'),('지랄'),('ㅈㄹ'),('닥쳐'),('꺼져'),('엿먹'),('엠창'),('느금'),('니애미'),('니미'),('느그애미'),('애미'),('애비'),
 ('섹스'),('야동'),('자지'),('보지'),('빠구리'),('걸레'),('창녀'),('등신'),('또라이'),('찐따'),('한남'),('한녀'),('틀딱'),('급식충'),('맘충'),
 ('죽어라'),('뒤져'),('뒈져'),('자살'),('fuck'),('fck'),('shit'),('bitch'),('asshole'),('dick'),('pussy'),('cunt'),('nigger'),('nigga'),('faggot'),('retard'),('bastard'),('porn'),('sex')
on conflict do nothing;

create or replace function public.bike_clean_text(p text)
returns text language plpgsql stable set search_path = public as $$
declare w record; pat text; res text := coalesce(p, ''); i int;
  allowed text[] := array['시바견','시바이누','새끼고양이','새끼강아지','새끼오리','새끼곰','새끼손가락','애비뉴'];
begin
  -- 괜찮은 말은 잠시 표시로 바꿔 두었다가 되돌림
  for i in 1..array_length(allowed, 1) loop
    res := replace(res, allowed[i], chr(1) || i::text || chr(2));
  end loop;
  for w in select word from public.bike_banned_words loop
    pat := '';
    for i in 1..char_length(w.word) loop
      if i > 1 then pat := pat || '[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]*'; end if;
      pat := pat || substr(w.word, i, 1);
    end loop;
    res := regexp_replace(res, pat, repeat('♡', char_length(w.word)), 'gi');
  end loop;
  for i in 1..array_length(allowed, 1) loop
    res := replace(res, chr(1) || i::text || chr(2), allowed[i]);
  end loop;
  return res;
end $$;

create or replace function public.bike_has_banned(p text)
returns boolean language sql stable set search_path = public as $$
  select public.bike_clean_text(p) <> coalesce(p, '')
$$;

create or replace function public.bike_mask_row()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'bike_chat' then
    new.message := public.bike_clean_text(new.message);
  end if;
  new.nickname := public.bike_clean_text(new.nickname);
  return new;
end $$;

create or replace trigger bike_chat_mask before insert on public.bike_chat for each row execute function public.bike_mask_row();
create or replace trigger bike_rides_mask before insert on public.bike_rides for each row execute function public.bike_mask_row();
create or replace trigger bike_times_mask before insert on public.bike_times for each row execute function public.bike_mask_row();

create or replace function public.bike_players_mask()
returns trigger language plpgsql set search_path = public as $$
begin
  new.nickname := public.bike_clean_text(new.nickname);
  if new.account_name is not null and public.bike_has_banned(new.account_name) then
    raise exception '쓸 수 없는 단어가 들어 있어요';
  end if;
  return new;
end $$;
create or replace trigger bike_players_mask before insert or update of nickname, account_name on public.bike_players
  for each row execute function public.bike_players_mask();

-- ── 1:1 대화 ──
create table if not exists public.bike_dms (
  id bigint generated always as identity primary key,
  sender uuid not null references public.bike_players(id),
  receiver uuid not null references public.bike_players(id),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists bike_dms_pair_idx on public.bike_dms (least(sender, receiver), greatest(sender, receiver), id desc);
create index if not exists bike_dms_receiver_idx on public.bike_dms (receiver, read_at);
alter table public.bike_dms enable row level security;
revoke all on public.bike_dms from anon, authenticated;

create or replace function public.bike_dm_send(p_id uuid, p_token text, p_to uuid, p_message text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.bike_players; m text := trim(coalesce(p_message, '')); rec public.bike_dms;
begin
  r := public.bike_auth(p_id, p_token);
  if p_to = r.id then raise exception '나에게는 보낼 수 없어요'; end if;
  if char_length(m) < 1 or char_length(m) > 300 then raise exception '메시지는 1~300자예요'; end if;
  if not exists (select 1 from public.bike_players where id = p_to) then raise exception '받는 사람을 찾을 수 없어요'; end if;
  if exists (select 1 from public.bike_dms where sender = r.id and created_at > now() - interval '700 milliseconds') then
    raise exception '너무 빨라요. 잠깐 뒤에 보내 주세요';
  end if;
  insert into public.bike_dms (sender, receiver, message) values (r.id, p_to, public.bike_clean_text(m)) returning * into rec;
  return jsonb_build_object('id', rec.id, 'from', rec.sender, 'to', rec.receiver, 'message', rec.message, 'at', rec.created_at);
end $$;

create or replace function public.bike_dm_list(p_id uuid, p_token text, p_with uuid, p_before bigint default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.bike_players; res jsonb;
begin
  r := public.bike_auth(p_id, p_token);
  update public.bike_dms set read_at = now() where receiver = r.id and sender = p_with and read_at is null;
  select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) into res from (
    select d.id, d.sender as "from", d.receiver as "to", d.message, d.created_at as at, d.read_at
      from public.bike_dms d
     where ((d.sender = r.id and d.receiver = p_with) or (d.sender = p_with and d.receiver = r.id))
       and (p_before is null or d.id < p_before)
     order by d.id desc limit 60
  ) x;
  return res;
end $$;

create or replace function public.bike_dm_threads(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare r public.bike_players; res jsonb;
begin
  r := public.bike_auth(p_id, p_token);
  select coalesce(jsonb_agg(t order by t.last_at desc), '[]'::jsonb) into res from (
    select other as id,
           (select nickname from public.bike_players p where p.id = other) as nickname,
           max(created_at) as last_at,
           (array_agg(message order by d_id desc))[1] as last_message,
           count(*) filter (where receiver = r.id and read_at is null) as unread
      from (
        select d.id as d_id, case when d.sender = r.id then d.receiver else d.sender end as other,
               d.created_at, d.message, d.receiver, d.read_at
          from public.bike_dms d where d.sender = r.id or d.receiver = r.id
      ) z
     group by other
     limit 50
  ) t;
  return res;
end $$;

revoke execute on function public.bike_dm_send(uuid, text, uuid, text) from public;
revoke execute on function public.bike_dm_list(uuid, text, uuid, bigint) from public;
revoke execute on function public.bike_dm_threads(uuid, text) from public;
grant execute on function public.bike_dm_send(uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.bike_dm_list(uuid, text, uuid, bigint) to anon, authenticated;
grant execute on function public.bike_dm_threads(uuid, text) to anon, authenticated;
