-- =============================================================================
-- Snap & Sell — full schema for your own Supabase project.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. It is safe to re-run at any time (every statement is idempotent),
-- so run it again whenever you pull a newer version of this file.
-- =============================================================================

create extension if not exists "pgcrypto";

/* ================================================================= profiles */
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  location text,
  last_seen_at timestamptz default now(),
  created_at timestamptz not null default now()
);

grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Usernames are unique ignoring case ("Maya" and "maya" cannot both exist).
do $$ begin
  create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
exception when others then
  raise notice 'Could not create the case-insensitive username index (duplicate usernames already exist?): %', sqlerrm;
end $$;

-- Builds a clean, URL-safe, unique username from whatever the person typed.
-- This is what stops "Database error saving new user" when two people pick the
-- same username or use spaces / symbols.
create or replace function public.generate_username(_base text, _id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_name text;
  v_try int := 0;
begin
  v_base := lower(regexp_replace(coalesce(_base, ''), '[^a-zA-Z0-9_.-]', '', 'g'));
  v_base := left(v_base, 24);
  if length(v_base) < 3 then
    v_base := 'user' || v_base;
  end if;
  v_name := v_base;
  while exists (
    select 1 from public.profiles p
    where lower(p.username) = v_name and p.id is distinct from _id
  ) loop
    v_try := v_try + 1;
    v_name := left(v_base, 20) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 4 + least(v_try / 5, 4));
  end loop;
  return v_name;
end;
$$;

-- Runs on every new sign-up (email or Google) and creates the profile row.
-- It must NEVER make sign-up fail, so any problem is logged as a warning and the
-- app creates the profile on first load instead (see ensure_my_profile below).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_username text;
begin
  v_username := public.generate_username(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    new.id
  );
  begin
    insert into public.profiles (id, username, display_name, avatar_url)
    values (
      new.id,
      v_username,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
      coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user could not create a profile for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- Safety net: creates the signed-in person's profile if it is missing (for
-- example accounts created before this schema was installed).
create or replace function public.ensure_my_profile()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_user auth.users;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;
  select * into v_user from auth.users where id = auth.uid();
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    auth.uid(),
    public.generate_username(
      coalesce(nullif(v_user.raw_user_meta_data->>'username', ''), split_part(coalesce(v_user.email, 'user'), '@', 1)),
      auth.uid()
    ),
    coalesce(v_user.raw_user_meta_data->>'full_name', v_user.raw_user_meta_data->>'name'),
    coalesce(v_user.raw_user_meta_data->>'avatar_url', v_user.raw_user_meta_data->>'picture')
  )
  on conflict (id) do nothing
  returning * into v_profile;
  if v_profile.id is null then
    select * into v_profile from public.profiles where id = auth.uid();
  end if;
  return v_profile;
end;
$$;

/* ============================================================== categories */
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon text
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);

insert into public.categories (name, slug, icon) values
  ('Electronics','electronics','Smartphone'),
  ('Fashion','fashion','Shirt'),
  ('Home & Garden','home-garden','Lamp'),
  ('Sports & Outdoors','sports-outdoors','Bike'),
  ('Books & Media','books-media','BookOpen'),
  ('Toys & Games','toys-games','Gamepad2'),
  ('Collectibles','collectibles','Gem'),
  ('Vehicles','vehicles','Car')
on conflict (slug) do nothing;

/* ================================================================= listings */
do $$ begin
  create type public.listing_status as enum ('available','reserved','sold','draft');
exception when duplicate_object then null; end $$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'USD',
  category_slug text not null references public.categories(slug),
  condition text not null check (condition in ('new','like_new','good','fair')),
  quantity int not null default 1 check (quantity > 0),
  status public.listing_status not null default 'available',
  location text,
  created_at timestamptz not null default now()
);
create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_created_idx on public.listings(created_at desc);

grant select on public.listings to anon;
grant select, insert, update, delete on public.listings to authenticated;
grant all on public.listings to service_role;
alter table public.listings enable row level security;
drop policy if exists "listings are public" on public.listings;
-- Drafts are only visible to the seller who owns them.
create policy "listings are public" on public.listings for select
  using (status <> 'draft' or auth.uid() = seller_id);
drop policy if exists "sellers insert own listings" on public.listings;
create policy "sellers insert own listings" on public.listings for insert to authenticated
  with check (auth.uid() = seller_id);
drop policy if exists "sellers update own listings" on public.listings;
create policy "sellers update own listings" on public.listings for update to authenticated
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
drop policy if exists "sellers delete own listings" on public.listings;
create policy "sellers delete own listings" on public.listings for delete to authenticated
  using (auth.uid() = seller_id);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  position int not null default 0
);
create index if not exists listing_images_listing_idx on public.listing_images(listing_id);
grant select on public.listing_images to anon;
grant select, insert, update, delete on public.listing_images to authenticated;
grant all on public.listing_images to service_role;
alter table public.listing_images enable row level security;
drop policy if exists "listing images are public" on public.listing_images;
create policy "listing images are public" on public.listing_images for select using (true);
drop policy if exists "owner writes listing images" on public.listing_images;
create policy "owner writes listing images" on public.listing_images for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

/* ============================================ wishlist & recently viewed */
create table if not exists public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
-- "update" is needed because upserts are INSERT ... ON CONFLICT DO UPDATE.
grant select, insert, update, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;
alter table public.wishlists enable row level security;
drop policy if exists "own wishlist" on public.wishlists;
create policy "own wishlist" on public.wishlists for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.recently_viewed (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
grant select, insert, update, delete on public.recently_viewed to authenticated;
grant all on public.recently_viewed to service_role;
alter table public.recently_viewed enable row level security;
drop policy if exists "own recently viewed" on public.recently_viewed;
create policy "own recently viewed" on public.recently_viewed for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* ============================================================ notifications */
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
grant select, delete on public.notifications to authenticated;
revoke update on public.notifications from authenticated;
grant update (read) on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete to authenticated using (auth.uid() = user_id);

create or replace function public.notify(_user uuid, _type text, _title text, _body text, _link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user is null then return; end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (_user, _type, _title, _body, _link);
end;
$$;
-- Only triggers may create notifications; otherwise anyone could spam anyone.
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

/* ================================================================== offers */
do $$ begin
  create type public.offer_status as enum ('pending','accepted','rejected','cancelled','countered');
exception when duplicate_object then null; end $$;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  message text,
  status public.offer_status not null default 'pending',
  created_by uuid not null references public.profiles(id) on delete cascade,
  parent_offer_id uuid references public.offers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_listing_idx on public.offers(listing_id, created_at desc);
create index if not exists offers_buyer_idx on public.offers(buyer_id);
create index if not exists offers_seller_idx on public.offers(seller_id);

do $$ begin
  alter table public.offers add constraint offers_buyer_not_seller check (buyer_id <> seller_id) not valid;
exception when duplicate_object then null; end $$;

-- Clients may only change an offer's status; everything else is locked.
grant select, insert on public.offers to authenticated;
revoke update on public.offers from authenticated;
grant update (status) on public.offers to authenticated;
grant all on public.offers to service_role;
alter table public.offers enable row level security;
drop policy if exists "participants read offers" on public.offers;
create policy "participants read offers" on public.offers for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
drop policy if exists "participants create offers" on public.offers;
create policy "participants create offers" on public.offers for insert to authenticated
  with check (auth.uid() = created_by and auth.uid() in (buyer_id, seller_id));
drop policy if exists "participants update offers" on public.offers;
create policy "participants update offers" on public.offers for update to authenticated
  using (auth.uid() in (buyer_id, seller_id)) with check (auth.uid() in (buyer_id, seller_id));

create table if not exists public.offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  amount numeric(12,2),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists offer_events_listing_idx on public.offer_events(listing_id, created_at desc);
-- History is written by triggers only, so nobody can forge it.
grant select on public.offer_events to authenticated;
revoke insert, update, delete on public.offer_events from authenticated;
grant all on public.offer_events to service_role;
alter table public.offer_events enable row level security;
drop policy if exists "participants read offer events" on public.offer_events;
create policy "participants read offer events" on public.offer_events for select to authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and auth.uid() in (o.buyer_id, o.seller_id)));
drop policy if exists "participants write offer events" on public.offer_events;

-- Enforces the negotiation rules on the server so they cannot be bypassed from
-- the browser: only a buyer can open an offer, only the OTHER side can accept /
-- decline / counter, only the author can cancel, and finished offers are final.
create or replace function public.validate_offer()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_parent public.offers;
begin
  if tg_op = 'INSERT' then
    select * into v_listing from public.listings where id = new.listing_id;
    if not found then
      raise exception 'Listing not found';
    end if;
    if new.seller_id <> v_listing.seller_id then
      raise exception 'The offer seller does not match the listing seller';
    end if;
    if new.buyer_id = new.seller_id then
      raise exception 'You cannot make an offer on your own listing';
    end if;
    if new.status <> 'pending' then
      raise exception 'New offers must start as pending';
    end if;

    if new.parent_offer_id is null then
      if v_uid is not null and new.created_by <> new.buyer_id then
        raise exception 'Only the buyer can start a negotiation';
      end if;
      if v_listing.status <> 'available' then
        raise exception 'This item is no longer available';
      end if;
      if exists (
        select 1 from public.offers o
        where o.listing_id = new.listing_id and o.buyer_id = new.buyer_id and o.status = 'pending'
      ) then
        raise exception 'You already have an open offer on this item';
      end if;
    else
      select * into v_parent from public.offers where id = new.parent_offer_id;
      if not found
         or v_parent.listing_id <> new.listing_id
         or v_parent.buyer_id <> new.buyer_id
         or v_parent.seller_id <> new.seller_id then
        raise exception 'Invalid counter offer';
      end if;
      if new.created_by = v_parent.created_by then
        raise exception 'You cannot counter your own offer';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if new.listing_id <> old.listing_id
     or new.buyer_id <> old.buyer_id
     or new.seller_id <> old.seller_id
     or new.amount <> old.amount
     or new.created_by <> old.created_by
     or new.parent_offer_id is distinct from old.parent_offer_id
     or new.message is distinct from old.message then
    raise exception 'Only the status of an offer can be changed';
  end if;

  if new.status is distinct from old.status and v_uid is not null then
    if old.status <> 'pending' then
      raise exception 'This offer has already been %', old.status;
    end if;
    if new.status = 'cancelled' then
      if v_uid <> old.created_by then
        raise exception 'Only the person who made the offer can cancel it';
      end if;
    elsif new.status in ('accepted', 'rejected', 'countered') then
      if v_uid = old.created_by or v_uid not in (old.buyer_id, old.seller_id) then
        raise exception 'Only the other person can respond to this offer';
      end if;
      if new.status = 'accepted' then
        select * into v_listing from public.listings where id = new.listing_id;
        if v_listing.status <> 'available' then
          raise exception 'This item is no longer available';
        end if;
      end if;
    else
      raise exception 'Invalid offer status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_01_validate on public.offers;
create trigger offers_01_validate before insert or update on public.offers
for each row execute function public.validate_offer();

-- log + notify on every offer action
create or replace function public.handle_offer_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_other uuid;
  v_listing text;
  v_link text;
begin
  select title into v_listing from public.listings where id = new.listing_id;
  v_link := '/product/' || new.listing_id::text;

  if tg_op = 'INSERT' then
    insert into public.offer_events (offer_id, listing_id, actor_id, type, amount, note)
    values (new.id, new.listing_id, new.created_by,
            case when new.parent_offer_id is null then 'offer' else 'counter' end,
            new.amount, new.message);
    v_other := case when new.created_by = new.buyer_id then new.seller_id else new.buyer_id end;
    v_title := case when new.parent_offer_id is null then 'New offer received' else 'Counter offer received' end;
    perform public.notify(v_other, 'offer', v_title, v_listing || ' — ' || new.amount::text, v_link);
    return new;
  end if;

  if new.status is distinct from old.status then
    new.updated_at := now();

    -- A counter is recorded (and notified) by the new offer row it creates.
    if new.status <> 'countered' then
      insert into public.offer_events (offer_id, listing_id, actor_id, type, amount, note)
      values (new.id, new.listing_id, auth.uid(), new.status::text, new.amount, null);

      v_other := case when auth.uid() = new.buyer_id then new.seller_id else new.buyer_id end;
      v_title := case new.status
        when 'accepted' then 'Offer accepted'
        when 'rejected' then 'Offer declined'
        when 'cancelled' then 'Offer cancelled'
        else 'Offer updated' end;
      perform public.notify(v_other, 'offer', v_title, v_listing || ' — ' || new.amount::text, v_link);
    end if;

    if new.status = 'accepted' then
      update public.listings set status = 'reserved' where id = new.listing_id and status = 'available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_after_insert on public.offers;
create trigger offers_after_insert after insert on public.offers
for each row execute function public.handle_offer_change();

drop trigger if exists offers_before_update on public.offers;
create trigger offers_before_update before update on public.offers
for each row execute function public.handle_offer_change();

-- Counter an offer in one safe step: the old offer is marked countered and the
-- new one is created together, or neither happens.
create or replace function public.counter_offer(_offer uuid, _amount numeric, _message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers;
  v_new uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if _amount is null or _amount <= 0 then
    raise exception 'Enter a valid amount';
  end if;
  select * into v_offer from public.offers where id = _offer for update;
  if not found or v_uid not in (v_offer.buyer_id, v_offer.seller_id) then
    raise exception 'Offer not found';
  end if;

  -- validate_offer() checks that the caller is allowed to respond to this offer
  update public.offers set status = 'countered' where id = _offer;

  insert into public.offers (listing_id, buyer_id, seller_id, amount, message, created_by, parent_offer_id)
  values (v_offer.listing_id, v_offer.buyer_id, v_offer.seller_id, _amount, nullif(trim(_message), ''), v_uid, v_offer.id)
  returning id into v_new;
  return v_new;
end;
$$;
revoke all on function public.counter_offer(uuid, numeric, text) from public, anon;
grant execute on function public.counter_offer(uuid, numeric, text) to authenticated;

-- notify the buyer when a listing they offered on changes status
create or replace function public.handle_listing_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select distinct buyer_id from public.offers where listing_id = new.id loop
      perform public.notify(r.buyer_id, 'listing',
        'Listing is now ' || new.status::text, new.title, '/product/' || new.id::text);
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists listings_status_notify on public.listings;
create trigger listings_status_notify after update on public.listings
for each row execute function public.handle_listing_status_change();

/* ============================================================ conversations */
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id)
);
create index if not exists conversations_buyer_idx on public.conversations(buyer_id);
create index if not exists conversations_seller_idx on public.conversations(seller_id);
-- "unique" ignores rows where listing_id is null, so direct chats need their own index.
create unique index if not exists conversations_direct_unique
  on public.conversations (buyer_id, seller_id) where listing_id is null;

grant select, insert on public.conversations to authenticated;
revoke update on public.conversations from authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
drop policy if exists "participants read conversations" on public.conversations;
create policy "participants read conversations" on public.conversations for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
drop policy if exists "participants create conversations" on public.conversations;
create policy "participants create conversations" on public.conversations for insert to authenticated
  with check (auth.uid() in (buyer_id, seller_id));
drop policy if exists "participants update conversations" on public.conversations;

create or replace function public.validate_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_seller uuid;
begin
  if new.buyer_id = new.seller_id then
    raise exception 'You cannot start a conversation with yourself';
  end if;
  if new.listing_id is not null then
    select seller_id into v_seller from public.listings where id = new.listing_id;
    if v_seller is null or v_seller <> new.seller_id then
      raise exception 'The conversation seller does not match the listing';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists conversations_validate on public.conversations;
create trigger conversations_validate before insert on public.conversations
for each row execute function public.validate_conversation();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','image','voice')),
  body text,
  attachment_url text,
  duration_ms int,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages(conversation_id) where read_at is null;

do $$ begin
  alter table public.messages add constraint messages_body_length check (char_length(body) <= 4000) not valid;
exception when duplicate_object then null; end $$;

-- Messages cannot be edited: the only column a client may change is read_at.
grant select, insert on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create or replace function public.is_conversation_member(_conversation uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = _conversation and _user in (c.buyer_id, c.seller_id)
  );
$$;

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and public.is_conversation_member(conversation_id, auth.uid()));
drop policy if exists "participants update messages" on public.messages;
-- You can only mark the OTHER person's messages as read.
create policy "participants update messages" on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()) and sender_id <> auth.uid())
  with check (public.is_conversation_member(conversation_id, auth.uid()) and sender_id <> auth.uid());

create or replace function public.handle_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_name text;
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
    into v_other from public.conversations c where c.id = new.conversation_id;
  select coalesce(display_name, username) into v_name from public.profiles where id = new.sender_id;
  perform public.notify(v_other, 'message', 'New message from ' || coalesce(v_name, 'a user'),
    case new.kind when 'image' then 'Sent a photo' when 'voice' then 'Sent a voice note'
      else left(coalesce(new.body, ''), 90) end,
    '/messages?c=' || new.conversation_id::text);
  return new;
end;
$$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
for each row execute function public.handle_new_message();

-- Helper functions that must not be callable from the browser.
revoke all on function public.generate_username(text, uuid) from public, anon, authenticated;
revoke all on function public.ensure_my_profile() from public, anon;
grant execute on function public.ensure_my_profile() to authenticated;

/* ================================================================ realtime */
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.offers;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.listings;
exception when duplicate_object then null; end $$;

/* ================================================================= storage */
insert into storage.buckets (id, name, public) values ('listing-images','listing-images', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('chat-media','chat-media', true)
  on conflict (id) do nothing;

-- Upload size limits (photos 8 MB, chat media 15 MB)
update storage.buckets set file_size_limit = 8388608 where id in ('listing-images', 'avatars');
update storage.buckets set file_size_limit = 15728640 where id = 'chat-media';

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects for select
  using (bucket_id in ('listing-images','avatars','chat-media'));

drop policy if exists "users upload own media" on storage.objects;
create policy "users upload own media" on storage.objects for insert to authenticated
  with check (bucket_id in ('listing-images','avatars','chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own media" on storage.objects;
create policy "users update own media" on storage.objects for update to authenticated
  using (bucket_id in ('listing-images','avatars','chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own media" on storage.objects;
create policy "users delete own media" on storage.objects for delete to authenticated
  using (bucket_id in ('listing-images','avatars','chat-media')
    and (storage.foldername(name))[1] = auth.uid()::text);
