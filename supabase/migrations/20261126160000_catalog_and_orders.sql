create schema blackbean_private;
revoke all on schema blackbean_private from public, anon, authenticated, service_role;

create table public.shops (
  id text primary key,
  name text not null,
  district text not null,
  opens_at_minute integer not null,
  closes_at_minute integer not null,
  check (opens_at_minute >= 0 and closes_at_minute <= 1440
    and closes_at_minute > opens_at_minute + 15)
);

create table public.products (
  id text primary key,
  category text not null check (category in ('coffee', 'cold', 'desserts')),
  name text not null,
  description text not null,
  price_kopecks integer not null check (price_kopecks between 1 and 1000000)
);

create table public.product_variants (
  product_id text references public.products on delete cascade,
  id text,
  name text not null,
  extra_kopecks integer not null check (extra_kopecks between 0 and 1000000),
  primary key (product_id, id)
);

create table public.modifier_groups (
  id text primary key,
  name text not null,
  default_label text not null
);

create table public.modifiers (
  id text primary key,
  group_id text not null references public.modifier_groups,
  name text not null,
  extra_kopecks integer not null check (extra_kopecks between 0 and 1000000)
);

create table public.product_modifier_groups (
  product_id text references public.products on delete cascade,
  group_id text references public.modifier_groups,
  primary key (product_id, group_id)
);

create table public.shop_products (
  shop_id text references public.shops on delete cascade,
  product_id text references public.products on delete cascade,
  available boolean not null,
  primary key (shop_id, product_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) between 1 and 70),
  bonus_balance_kopecks bigint not null default 0 check (bonus_balance_kopecks >= 0)
);

create table blackbean_private.admin_users (
  user_id uuid primary key references auth.users on delete cascade
);

create type public.order_status as enum (
  'new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled'
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles,
  shop_id text not null references public.shops,
  status public.order_status not null default 'new',
  pickup_timing text not null check (pickup_timing in ('asap', 'scheduled')),
  pickup_at timestamptz not null,
  contact_name text not null check (char_length(contact_name) between 1 and 70),
  contact_phone text not null check (contact_phone ~ '^\+380[0-9]{9}$'),
  comment text not null check (char_length(comment) <= 300),
  subtotal_kopecks bigint not null check (subtotal_kopecks > 0),
  bonus_used_kopecks bigint not null
    check (bonus_used_kopecks between 0 and subtotal_kopecks * 30 / 100),
  total_due_kopecks bigint generated always as (subtotal_kopecks - bonus_used_kopecks) stored,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key uuid not null unique,
  request_hash bytea not null,
  check (user_id is not null or bonus_used_kopecks = 0),
  check ((status = 'completed') = (paid_at is not null))
);

create index orders_user_history_idx on public.orders (user_id, created_at desc);
create index orders_shop_pickup_idx on public.orders (shop_id, pickup_at);

create table public.order_items (
  order_id uuid references public.orders on delete cascade,
  line_number integer check (line_number between 1 and 30),
  product_id text not null,
  product_name text not null,
  base_price_kopecks integer not null check (base_price_kopecks > 0),
  variant_id text not null,
  variant_name text not null,
  variant_extra_kopecks integer not null check (variant_extra_kopecks >= 0),
  modifiers jsonb not null check (jsonb_typeof(modifiers) = 'array'),
  unit_price_kopecks integer not null check (unit_price_kopecks > 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total_kopecks integer generated always as (unit_price_kopecks * quantity) stored,
  primary key (order_id, line_number)
);

create table public.bonus_transactions (
  order_id uuid references public.orders,
  kind text check (kind in ('reserve', 'return', 'earn')),
  user_id uuid not null references public.profiles,
  amount_kopecks bigint not null,
  created_at timestamptz not null default now(),
  check ((kind = 'reserve' and amount_kopecks < 0)
    or (kind in ('return', 'earn') and amount_kopecks > 0)),
  primary key (order_id, kind)
);

create index bonus_transactions_user_idx on public.bonus_transactions (user_id, created_at desc);

create function blackbean_private.create_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function blackbean_private.create_profile() from public, anon, authenticated, service_role;

create trigger blackbean_create_profile
after insert on auth.users
for each row execute function blackbean_private.create_profile();

insert into public.profiles (user_id)
select id from auth.users on conflict do nothing;

create function blackbean_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from blackbean_private.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function blackbean_private.is_admin() from public, anon, authenticated, service_role;
grant execute on function blackbean_private.is_admin() to authenticated;

do $$
declare
  relation text;
begin
  foreach relation in array array[
    'shops', 'products', 'product_variants', 'modifier_groups', 'modifiers',
    'product_modifier_groups', 'shop_products', 'profiles', 'orders', 'order_items',
    'bonus_transactions'
  ] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', relation);
  end loop;

  foreach relation in array array[
    'shops', 'products', 'product_variants', 'modifier_groups', 'modifiers',
    'product_modifier_groups', 'shop_products'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', relation);
    execute format(
      'create policy catalog_read on public.%I for select to anon, authenticated using (true)', relation
    );
  end loop;
end;
$$;

alter table blackbean_private.admin_users enable row level security;
revoke all on blackbean_private.admin_users from public, anon, authenticated, service_role;

grant select on public.profiles, public.orders, public.order_items, public.bonus_transactions
to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy own_profile_read on public.profiles for select to authenticated
using (user_id = (select auth.uid()));
create policy own_profile_edit on public.profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy order_read on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select blackbean_private.is_admin()));
create policy order_items_read on public.order_items for select to authenticated
using (exists (select 1 from public.orders where id = order_id));
create policy own_bonuses_read on public.bonus_transactions for select to authenticated
using (user_id = (select auth.uid()));
