-- ============================================================
-- Aucta — Supabase schema, security, and server logic
-- Run this whole file in the Supabase SQL Editor (one shot).
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  dob date,
  role_title text,
  location text,
  onboarded boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- AUCTIONS ----------
create table if not exists public.auctions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_at timestamptz,
  auto_start boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- LISTINGS ----------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete set null,
  seller_email text,
  seller_name text,
  title text not null,
  category text not null,
  condition text not null,
  description text,
  base_price numeric not null check (base_price >= 0),
  image_url text,
  status text not null default 'pending' check (status in ('pending','live','sold','unsold','rejected')),
  auction_id uuid references public.auctions(id) on delete set null,
  current_bid numeric,
  high_bidder_id uuid,
  high_bidder_email text,
  high_bidder_name text,
  bid_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- BIDS (append-only ledger) ----------
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  bidder_id uuid references auth.users(id) on delete set null,
  bidder_email text,
  amount numeric not null,
  created_at timestamptz not null default now()
);

-- ---------- WATCHLISTS ----------
create table if not exists public.watchlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------- PARTICIPANTS ----------
create table if not exists public.participants (
  auction_id uuid not null references public.auctions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  primary key (auction_id, user_id)
);

-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  kind text not null,                 -- listed | won | sold | unsold
  item_title text,
  auction_name text,
  amount numeric,
  counterparty text,                  -- buyer (for sold) or seller (for won)
  created_at timestamptz not null default now()
);

-- ============================================================
-- SERVER LOGIC
-- ============================================================

create or replace function public.min_increment(p numeric)
returns numeric language sql immutable as $$
  select case when p < 5000 then 100 when p < 25000 then 250 when p < 100000 then 500 else 1000 end;
$$;

-- Atomic, race-safe bid. This is the heart of the live auction.
create or replace function public.place_bid(p_listing_id uuid, p_amount numeric)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  a public.auctions;
  next_min numeric;
  uid uuid := auth.uid();
  uemail text := auth.jwt() ->> 'email';
  uname text;
begin
  if uid is null then raise exception 'You must be signed in to bid'; end if;
  select display_name into uname from public.profiles where id = uid;
  select * into l from public.listings where id = p_listing_id for update;     -- row lock
  if not found then raise exception 'Lot not found'; end if;
  if l.status <> 'live' then raise exception 'This lot is not open for bids'; end if;
  select * into a from public.auctions where id = l.auction_id;
  if a.status <> 'live' then raise exception 'The auction is not live'; end if;
  next_min := case when l.current_bid is null then l.base_price
                   else l.current_bid + public.min_increment(l.current_bid) end;
  if p_amount < next_min then raise exception 'Bid must be at least %', next_min; end if;

  update public.listings
     set current_bid = p_amount, high_bidder_id = uid, high_bidder_email = uemail,
         high_bidder_name = coalesce(uname, split_part(uemail,'@',1)), bid_count = bid_count + 1
   where id = p_listing_id returning * into l;

  insert into public.bids (listing_id, bidder_id, bidder_email, amount)
  values (p_listing_id, uid, uemail, p_amount);

  insert into public.participants (auction_id, user_id, email)
  values (l.auction_id, uid, uemail) on conflict do nothing;

  return l;
end; $$;

-- Admin: verify a pending listing onto an auction (+ notify seller)
create or replace function public.verify_listing(p_listing_id uuid, p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare l public.listings; a public.auctions;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into a from public.auctions where id = p_auction_id;
  update public.listings
     set status='live', auction_id=p_auction_id, current_bid=null, high_bidder_id=null, high_bidder_email=null, high_bidder_name=null, bid_count=0
   where id = p_listing_id returning * into l;
  insert into public.notifications (user_id, user_email, kind, item_title, auction_name)
  values (l.seller_id, l.seller_email, 'listed', l.title, a.name);
end; $$;

create or replace function public.reject_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.listings set status='rejected' where id=p_listing_id;
end; $$;

create or replace function public.return_to_review(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.listings
     set status='pending', auction_id=null, current_bid=null, high_bidder_id=null, high_bidder_email=null, high_bidder_name=null, bid_count=0
   where id=p_listing_id;
end; $$;

create or replace function public.move_unsold(p_listing_id uuid, p_auction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare st text; tst text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select status into st  from public.listings where id=p_listing_id;
  select status into tst from public.auctions where id=p_auction_id;
  if st <> 'unsold' then raise exception 'Only unsold lots can be moved'; end if;
  if tst <> 'scheduled' then raise exception 'Target must be a scheduled (future) auction'; end if;
  update public.listings
     set status='live', auction_id=p_auction_id, current_bid=null, high_bidder_id=null, high_bidder_email=null, high_bidder_name=null, bid_count=0
   where id=p_listing_id;
end; $$;

create or replace function public.create_auction(p_name text, p_start_at timestamptz, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into public.auctions (name, start_at, auto_start, status) values (p_name, p_start_at, p_auto, 'scheduled');
end; $$;

create or replace function public.reschedule_auction(p_id uuid, p_start_at timestamptz, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.auctions set status='scheduled', start_at=p_start_at, auto_start=p_auto, ends_at=null where id=p_id;
end; $$;

create or replace function public.start_auction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.auctions
     set status='live', ends_at = now() + interval '5 minutes'
   where id = p_id and status = 'scheduled'
     and (public.is_admin() or (auto_start and start_at is not null and start_at <= now()));
end; $$;

-- Settle an auction: mark sold/unsold and create notifications for both sides.
create or replace function public.end_auction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions; r public.listings;
begin
  select * into a from public.auctions where id = p_id for update;
  if not found or a.status <> 'live' then return; end if;
  -- normal users may only trigger this once the clock is up; admins anytime.
  if not public.is_admin() and (a.ends_at is null or a.ends_at > now()) then
    raise exception 'Auction is still running';
  end if;

  for r in select * from public.listings where auction_id = p_id and status = 'live' loop
    if r.bid_count > 0 then
      update public.listings set status='sold' where id = r.id;
      insert into public.notifications (user_id,user_email,kind,item_title,auction_name,amount,counterparty)
        values (r.seller_id, r.seller_email, 'sold', r.title, a.name, r.current_bid, coalesce(r.high_bidder_name, r.high_bidder_email));
      insert into public.notifications (user_id,user_email,kind,item_title,auction_name,amount,counterparty)
        values (r.high_bidder_id, r.high_bidder_email, 'won', r.title, a.name, r.current_bid, coalesce(r.seller_name, r.seller_email));
    else
      update public.listings set status='unsold' where id = r.id;
      insert into public.notifications (user_id,user_email,kind,item_title,auction_name)
        values (r.seller_id, r.seller_email, 'unsold', r.title, a.name);
    end if;
  end loop;

  update public.auctions set status='ended' where id = p_id;
end; $$;

create or replace function public.delete_auction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select status into st from public.auctions where id=p_id;
  if st = 'scheduled' then
    update public.listings set status='pending', auction_id=null, current_bid=null, high_bidder_id=null, high_bidder_email=null, high_bidder_name=null, bid_count=0
     where auction_id=p_id;
  else
    delete from public.listings where auction_id=p_id;
  end if;
  delete from public.auctions where id=p_id;
end; $$;

create or replace function public.delete_auctions_by_status(p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status = 'scheduled' then
    update public.listings set status='pending', auction_id=null, current_bid=null, high_bidder_id=null, high_bidder_email=null, high_bidder_name=null, bid_count=0
     where auction_id in (select id from public.auctions where status='scheduled');
  else
    delete from public.listings where auction_id in (select id from public.auctions where status=p_status);
  end if;
  delete from public.auctions where status=p_status;
end; $$;

-- Cron tick: auto-start due auctions, auto-close expired ones.
create or replace function public.run_auction_tick()
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions;
begin
  for a in select * from public.auctions
           where status='scheduled' and auto_start and start_at is not null and start_at <= now() loop
    update public.auctions set status='live', ends_at = now() + interval '5 minutes' where id = a.id;
  end loop;
  for a in select * from public.auctions
           where status='live' and ends_at is not null and ends_at <= now() loop
    perform public.end_auction(a.id);
  end loop;
end; $$;

-- run every minute (client also closes rooms the instant the timer hits 0 for snappier UX)
select cron.schedule('aucta-tick', '* * * * *', $$ select public.run_auction_tick(); $$);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.auctions      enable row level security;
alter table public.listings      enable row level security;
alter table public.bids          enable row level security;
alter table public.watchlists    enable row level security;
alter table public.participants  enable row level security;
alter table public.notifications enable row level security;

-- profiles: a user reads/writes only their own row
create policy "profiles self read"   on public.profiles for select using (id = auth.uid());
create policy "profiles self insert" on public.profiles for insert with check (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid());

-- auctions & listings & bids: public read (anonymous browsing allowed); writes go through RPCs
create policy "auctions public read" on public.auctions for select using (true);
create policy "listings public read" on public.listings for select using (true);
create policy "bids public read"     on public.bids     for select using (true);

-- sellers may create their own pending listing only
create policy "listings insert own" on public.listings for insert
  with check (seller_id = auth.uid() and status = 'pending' and auction_id is null);

-- watchlists: each user manages their own rows
create policy "watch read own"   on public.watchlists for select using (user_id = auth.uid());
create policy "watch insert own" on public.watchlists for insert with check (user_id = auth.uid());
create policy "watch delete own" on public.watchlists for delete using (user_id = auth.uid());

-- participants: public read (for room counts), each user inserts their own
create policy "part read"       on public.participants for select using (true);
create policy "part insert own" on public.participants for insert with check (user_id = auth.uid());

-- notifications: each user reads/deletes only their own
create policy "notif read own"   on public.notifications for select using (user_id = auth.uid());
create policy "notif delete own" on public.notifications for delete using (user_id = auth.uid());

grant execute on all functions in schema public to anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.listings;
alter publication supabase_realtime add table public.auctions;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- STORAGE (public bucket for lot photos)
-- ============================================================
insert into storage.buckets (id, name, public) values ('lot-images','lot-images', true)
  on conflict (id) do nothing;

create policy "lot images public read" on storage.objects
  for select using (bucket_id = 'lot-images');
create policy "lot images authed upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'lot-images');

-- ============================================================
-- MAKE YOURSELF ADMIN (after you have signed in once with Google):
--   update public.profiles set is_admin = true where email = 'you@gmail.com';
-- ============================================================
