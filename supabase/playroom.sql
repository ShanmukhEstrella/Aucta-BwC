-- ============================================================
-- Aucta — "Play with Friends" mock IPL mega auction
-- Run in the Supabase SQL Editor (after schema.sql). Safe to re-run.
-- Amounts are in ₹ LAKH (10000 = ₹100 crore).
-- ============================================================

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references auth.users(id) on delete set null,
  name text not null,
  purse_total int not null default 10000,
  max_squad int not null default 25,
  min_squad int not null default 18,
  max_overseas int not null default 8,
  status text not null default 'lobby' check (status in ('lobby','running','done')),
  current_lot_id uuid,
  call_stage int not null default 0,
  call_deadline timestamptz,
  last_player text, last_team text, last_price int, last_status text,
  end_requested_by uuid references auth.users(id) on delete set null,
  end_requested_at timestamptz,
  end_agree_ids uuid[] not null default '{}',
  skip_lot_id uuid,
  skip_vote_ids uuid[] not null default '{}',
  started_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.game_rooms add column if not exists max_squad int not null default 25;
alter table public.game_rooms add column if not exists min_squad int not null default 18;
alter table public.game_rooms add column if not exists max_overseas int not null default 8;
alter table public.game_rooms add column if not exists started_at timestamptz;
alter table public.game_rooms add column if not exists end_requested_by uuid references auth.users(id) on delete set null;
alter table public.game_rooms add column if not exists end_requested_at timestamptz;
alter table public.game_rooms add column if not exists end_agree_ids uuid[] not null default '{}';
alter table public.game_rooms add column if not exists skip_lot_id uuid;
alter table public.game_rooms add column if not exists skip_vote_ids uuid[] not null default '{}';

create table if not exists public.room_members (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  team_short text,
  purse_remaining int not null,
  user_email text,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
-- Clean up old duplicate franchise picks before enforcing one team per room.
-- Keeps the earliest joined member for each room/team and removes later duplicates.
delete from public.room_members rm
using (
  select ctid
  from (
    select ctid, row_number() over (partition by room_id, team_short order by joined_at, user_id) as rn
    from public.room_members
    where team_short is not null
  ) ranked
  where rn > 1
) dupes
where rm.ctid = dupes.ctid;
create unique index if not exists room_team_unique on public.room_members (room_id, team_short);

create table if not exists public.room_lots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_name text not null,
  role text,
  country text,
  overseas boolean not null default false,
  stats jsonb,
  base_price int not null default 20,
  set_name text,
  tier text,
  category text,
  pool_order int not null default 0,
  status text not null default 'queued' check (status in ('queued','on_block','sold','unsold')),
  cur_bid int,
  high_bidder_id uuid,
  high_team text,
  sold_to uuid,
  sold_price int
);
alter table public.room_lots add column if not exists overseas boolean not null default false;
alter table public.room_lots add column if not exists stats jsonb;
alter table public.room_lots add column if not exists tier text;
alter table public.room_lots add column if not exists category text;

create table if not exists public.room_bids (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  lot_id uuid not null references public.room_lots(id) on delete cascade,
  bidder_id uuid,
  team_name text,
  amount int not null,
  created_at timestamptz not null default now()
);

create or replace function public.play_min_inc(cur int)
returns int language sql immutable as $$
  select case when cur is null then 0 when cur < 100 then 10 when cur < 200 then 20 else 25 end;
$$;

-- ---------- create / join ----------
create or replace function public.create_play_room(p_name text, p_purse int, p_team text, p_short text, p_lots jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_code text; itm jsonb; i int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 5));
  insert into public.game_rooms (code, host_id, name, purse_total, status)
  values (v_code, auth.uid(), p_name, coalesce(p_purse, 10000), 'lobby') returning id into v_room;

  insert into public.room_members (room_id, user_id, team_name, team_short, purse_remaining, user_email, display_name)
  values (v_room, auth.uid(), p_team, p_short, coalesce(p_purse, 10000),
          auth.jwt() ->> 'email', (select display_name from public.profiles where id = auth.uid()));

  for itm in select * from jsonb_array_elements(p_lots) loop
    insert into public.room_lots (room_id, player_name, role, country, overseas, stats, base_price, set_name, tier, category, pool_order, status)
    values (v_room, itm->>'name', itm->>'role', itm->>'country',
            coalesce((itm->>'overseas')::boolean, false), itm->'stats',
            coalesce((itm->>'base')::int, 20), itm->>'set', itm->>'tier', itm->>'category', i, 'queued');
    i := i + 1;
  end loop;
  return v_room;
end; $$;

create or replace function public.join_play_room(p_code text, p_team text, p_short text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_room uuid; v_purse int; v_status text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id, purse_total, status into v_room, v_purse, v_status from public.game_rooms where code = upper(p_code);
  if v_room is null then raise exception 'Room not found — check the code'; end if;
  if exists (select 1 from public.room_members where room_id = v_room and user_id = auth.uid()) then
    return v_room;
  end if;
  if v_status <> 'lobby' then raise exception 'This auction has already started'; end if;
  if exists (select 1 from public.room_members where room_id = v_room and team_short = p_short and user_id <> auth.uid()) then
    raise exception 'That franchise is already taken — pick another';
  end if;
  insert into public.room_members (room_id, user_id, team_name, team_short, purse_remaining, user_email, display_name)
  values (v_room, auth.uid(), p_team, p_short, v_purse, auth.jwt() ->> 'email',
          (select display_name from public.profiles where id = auth.uid()));
  return v_room;
end; $$;

create or replace function public.start_play_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  if (select host_id from public.game_rooms where id = p_room) <> auth.uid() then raise exception 'Only the host can start'; end if;
  select id into nxt from public.room_lots where room_id = p_room and status = 'queued' order by pool_order limit 1;
  if nxt is null then raise exception 'No players in the pool'; end if;
  update public.room_lots set status = 'on_block' where id = nxt;
  update public.game_rooms set status = 'running', current_lot_id = nxt, call_stage = 0, started_at = now(),
         call_deadline = now() + interval '12 seconds', skip_lot_id = nxt, skip_vote_ids = '{}' where id = p_room;
end; $$;

-- ---------- bidding: purse + squad quotas enforced, timer +3s capped 15s ----------
create or replace function public.place_room_bid(p_room uuid, p_lot uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare r public.game_rooms; lot public.room_lots; mem public.room_members; nm int;
        squad_n int; overseas_n int; rem numeric; new_rem numeric;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'running' then raise exception 'The auction is not running'; end if;
  select * into lot from public.room_lots where id = p_lot;
  if lot.status <> 'on_block' or r.current_lot_id <> p_lot then raise exception 'That player is not on the block'; end if;
  select * into mem from public.room_members where room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'Join the room first'; end if;
  if lot.high_bidder_id = auth.uid() then raise exception 'You are already the top bidder'; end if;

  -- squad quota (block entirely at the cap)
  select count(*) into squad_n from public.room_lots where room_id = p_room and sold_to = auth.uid() and status = 'sold';
  if squad_n >= r.max_squad then raise exception 'Your squad is full (max % players)', r.max_squad; end if;
  if lot.overseas then
    select count(*) into overseas_n from public.room_lots
      where room_id = p_room and sold_to = auth.uid() and status = 'sold' and overseas = true;
    if overseas_n >= r.max_overseas then raise exception 'Overseas quota full (max % overseas)', r.max_overseas; end if;
  end if;

  nm := case when lot.cur_bid is null then lot.base_price else lot.cur_bid + public.play_min_inc(lot.cur_bid) end;
  if p_amount < nm then raise exception 'Bid must be at least %', nm; end if;
  if p_amount > mem.purse_remaining then raise exception 'That is over your remaining purse'; end if;

  update public.room_lots set cur_bid = p_amount, high_bidder_id = auth.uid(), high_team = mem.team_name where id = p_lot;

  -- extend the clock by 3s, never above 15s remaining; reopen if mid-call
  rem := greatest(0, extract(epoch from (r.call_deadline - now())));
  new_rem := least(rem + 3, 15);
  update public.game_rooms set call_stage = 0, call_deadline = now() + (new_rem * interval '1 second'),
         skip_lot_id = p_lot, skip_vote_ids = '{}' where id = p_room;

  insert into public.room_bids (room_id, lot_id, bidder_id, team_name, amount) values (p_room, p_lot, auth.uid(), mem.team_name, p_amount);
end; $$;

-- ---------- skip voting: if every joined team skips, player is immediately unsold ----------
create or replace function public.skip_room_lot(p_room uuid, p_lot uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.game_rooms; lot public.room_lots; member_count int; skip_count int; votes uuid[];
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id = p_room for update;
  if not found then raise exception 'Room not found'; end if;
  if r.status <> 'running' then raise exception 'The auction is not running'; end if;
  if r.current_lot_id <> p_lot or r.call_stage <> 0 then raise exception 'That player cannot be skipped right now'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid()) then raise exception 'Join the room first'; end if;

  select * into lot from public.room_lots where id = p_lot;
  if lot.status <> 'on_block' then raise exception 'That player is not on the block'; end if;
  if lot.high_bidder_id is not null then raise exception 'Bidding has already started for this player'; end if;

  votes := case when r.skip_lot_id = p_lot then coalesce(r.skip_vote_ids, '{}') else '{}' end;
  if not (auth.uid() = any(votes)) then
    votes := array_append(votes, auth.uid());
  end if;

  update public.game_rooms
     set skip_lot_id = p_lot,
         skip_vote_ids = votes
   where id = p_room;

  select count(*) into member_count from public.room_members where room_id = p_room;
  select count(distinct x) into skip_count from unnest(votes) as x
    where x in (select user_id from public.room_members where room_id = p_room);

  if member_count > 0 and skip_count >= member_count then
    update public.room_lots set status = 'unsold' where id = p_lot;
    update public.game_rooms
       set call_stage = 3,
           call_deadline = now() + interval '2 seconds',
           last_player = lot.player_name,
           last_team = null,
           last_price = null,
           last_status = 'skipped',
           skip_lot_id = p_lot,
           skip_vote_ids = votes
     where id = p_room;
  end if;
end; $$;

-- ---------- automated auctioneer ----------
create or replace function public.advance_play(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.game_rooms; lot public.room_lots; nxt uuid;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or r.status <> 'running' then return; end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid()) then return; end if;
  if r.call_deadline is null or now() < r.call_deadline then return; end if;

  if r.call_stage < 2 then
    update public.game_rooms set call_stage = r.call_stage + 1, call_deadline = now() + interval '3 seconds' where id = p_room;
    return;
  end if;

  if r.call_stage = 2 then
    select * into lot from public.room_lots where id = r.current_lot_id;
    if lot.high_bidder_id is not null then
      update public.room_lots set status = 'sold', sold_to = lot.high_bidder_id, sold_price = lot.cur_bid where id = lot.id;
      update public.room_members set purse_remaining = purse_remaining - lot.cur_bid where room_id = p_room and user_id = lot.high_bidder_id;
      update public.game_rooms set call_stage = 3, call_deadline = now() + interval '3 seconds',
             last_player = lot.player_name, last_team = lot.high_team, last_price = lot.cur_bid, last_status = 'sold',
             skip_lot_id = lot.id, skip_vote_ids = '{}' where id = p_room;
    else
      update public.room_lots set status = 'unsold' where id = lot.id;
      update public.game_rooms set call_stage = 3, call_deadline = now() + interval '3 seconds',
             last_player = lot.player_name, last_team = null, last_price = null, last_status = 'unsold',
             skip_lot_id = lot.id, skip_vote_ids = '{}' where id = p_room;
    end if;
    return;
  end if;

  select id into nxt from public.room_lots where room_id = p_room and status = 'queued' order by pool_order limit 1;
  if nxt is null then
    update public.game_rooms set status = 'done', current_lot_id = null, call_stage = 0, call_deadline = null,
           skip_lot_id = null, skip_vote_ids = '{}' where id = p_room;
  else
    update public.room_lots set status = 'on_block' where id = nxt;
    update public.game_rooms set current_lot_id = nxt, call_stage = 0, call_deadline = now() + interval '12 seconds',
           skip_lot_id = nxt, skip_vote_ids = '{}' where id = p_room;
  end if;
end; $$;

-- ---------- host can request an early finish; every joined team must agree ----------
create or replace function public.request_end_play_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare agree_count int; member_count int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select host_id from public.game_rooms where id = p_room) <> auth.uid() then raise exception 'Only the host can request ending the auction'; end if;
  update public.game_rooms
     set end_requested_by = auth.uid(),
         end_requested_at = coalesce(end_requested_at, now()),
         end_agree_ids = case when auth.uid() = any(coalesce(end_agree_ids, '{}')) then coalesce(end_agree_ids, '{}') else array_append(coalesce(end_agree_ids, '{}'), auth.uid()) end
   where id = p_room and status <> 'done';

  select count(*) into member_count from public.room_members where room_id = p_room;
  select count(distinct x) into agree_count from unnest((select end_agree_ids from public.game_rooms where id = p_room)) as x
    where x in (select user_id from public.room_members where room_id = p_room);

  if member_count > 0 and agree_count >= member_count then
    update public.game_rooms
       set status = 'done', current_lot_id = null, call_stage = 0, call_deadline = null
     where id = p_room;
    update public.room_lots set status = 'unsold' where room_id = p_room and status = 'on_block';
  end if;
end; $$;

create or replace function public.agree_end_play_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.game_rooms; agree_count int; member_count int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into r from public.game_rooms where id = p_room for update;
  if not found then raise exception 'Room not found'; end if;
  if r.status = 'done' then return; end if;
  if r.end_requested_at is null then raise exception 'The host has not requested to end this auction'; end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid()) then raise exception 'Join the room first'; end if;

  update public.game_rooms
     set end_agree_ids = case when auth.uid() = any(coalesce(end_agree_ids, '{}')) then coalesce(end_agree_ids, '{}') else array_append(coalesce(end_agree_ids, '{}'), auth.uid()) end
   where id = p_room;

  select count(*) into member_count from public.room_members where room_id = p_room;
  select count(distinct x) into agree_count from unnest((select end_agree_ids from public.game_rooms where id = p_room)) as x
    where x in (select user_id from public.room_members where room_id = p_room);

  if member_count > 0 and agree_count >= member_count then
    update public.game_rooms
       set status = 'done', current_lot_id = null, call_stage = 0, call_deadline = null
     where id = p_room;
    update public.room_lots set status = 'unsold' where room_id = p_room and status = 'on_block';
  end if;
end; $$;

-- ---------- RLS ----------
alter table public.game_rooms   enable row level security;
alter table public.room_members enable row level security;
alter table public.room_lots    enable row level security;
alter table public.room_bids    enable row level security;

drop policy if exists "rooms read"   on public.game_rooms;
drop policy if exists "members read" on public.room_members;
drop policy if exists "lots read"    on public.room_lots;
drop policy if exists "bids read"    on public.room_bids;
create policy "rooms read"   on public.game_rooms   for select to authenticated using (true);
create policy "members read" on public.room_members for select to authenticated using (true);
create policy "lots read"    on public.room_lots    for select to authenticated using (true);
create policy "bids read"    on public.room_bids    for select to authenticated using (true);

grant execute on all functions in schema public to anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.game_rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.room_lots;
exception when duplicate_object then null; end $$;
