-- yahomi 프로젝트에 적용된 스키마 (이미 적용됨)
create table if not exists public.bike_chat (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 16),
  bike text not null check (char_length(bike) between 1 and 24),
  color text not null default '#ffb703' check (color ~ '^#[0-9a-fA-F]{6}$'),
  message text not null check (char_length(message) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists bike_chat_created_at_idx on public.bike_chat (created_at desc);

create table if not exists public.bike_rides (
  id bigint generated always as identity primary key,
  nickname text not null check (char_length(nickname) between 1 and 16),
  bike text not null check (char_length(bike) between 1 and 24),
  distance integer not null check (distance between 0 and 100000),
  stars integer not null default 0 check (stars between 0 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists bike_rides_distance_idx on public.bike_rides (distance desc);

alter table public.bike_chat enable row level security;
alter table public.bike_rides enable row level security;

create policy "bike_chat read" on public.bike_chat for select to anon, authenticated using (true);
create policy "bike_chat insert" on public.bike_chat for insert to anon, authenticated with check (true);
create policy "bike_rides read" on public.bike_rides for select to anon, authenticated using (true);
create policy "bike_rides insert" on public.bike_rides for insert to anon, authenticated with check (true);

alter publication supabase_realtime add table public.bike_chat;

-- 묘기 점수 (2번째 마이그레이션)
alter table public.bike_rides add column if not exists trick_score integer not null default 0 check (trick_score between 0 and 10000000);
create index if not exists bike_rides_trick_idx on public.bike_rides (trick_score desc);
