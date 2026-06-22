-- ============================================================
-- Aucta migration v2 — profile onboarding fields + display names
-- Run this in the Supabase SQL Editor IF you already ran the original schema.sql.
-- (A fresh schema.sql already includes everything below.)
-- Safe to run more than once.
-- ============================================================

alter table public.profiles
  add column if not exists dob date,
  add column if not exists role_title text,
  add column if not exists location text,
  add column if not exists onboarded boolean not null default false;

alter table public.listings
  add column if not exists seller_name text,
  add column if not exists high_bidder_name text;

-- record the bidder's display name so other users see names, not emails
create or replace function public.place_bid(p_listing_id uuid, p_amount numeric)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  l public.listings; a public.auctions; next_min numeric;
  uid uuid := auth.uid(); uemail text := auth.jwt() ->> 'email'; uname text;
begin
  if uid is null then raise exception 'You must be signed in to bid'; end if;
  select display_name into uname from public.profiles where id = uid;
  select * into l from public.listings where id = p_listing_id for update;
  if not found then raise exception 'Lot not found'; end if;
  if l.status <> 'live' then raise exception 'This lot is not open for bids'; end if;
  select * into a from public.auctions where id = l.auction_id;
  if a.status <> 'live' then raise exception 'The auction is not live'; end if;
  next_min := case when l.current_bid is null then l.base_price
                   else l.current_bid + public.min_increment(l.current_bid) end;
  if p_amount < next_min then raise exception 'Bid must be at least %', next_min; end if;
  update public.listings
     set current_bid=p_amount, high_bidder_id=uid, high_bidder_email=uemail,
         high_bidder_name=coalesce(uname, split_part(uemail,'@',1)), bid_count=bid_count+1
   where id=p_listing_id returning * into l;
  insert into public.bids (listing_id, bidder_id, bidder_email, amount) values (p_listing_id, uid, uemail, p_amount);
  insert into public.participants (auction_id, user_id, email) values (l.auction_id, uid, uemail) on conflict do nothing;
  return l;
end; $$;

-- settlement notifications now carry display names as the counterparty
create or replace function public.end_auction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.auctions; r public.listings;
begin
  select * into a from public.auctions where id = p_id for update;
  if not found or a.status <> 'live' then return; end if;
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

grant execute on all functions in schema public to anon, authenticated;
