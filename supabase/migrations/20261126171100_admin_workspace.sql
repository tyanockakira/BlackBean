create function public.admin_access()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select blackbean_private.is_admin();
$$;

create function public.admin_dashboard(p_from date, p_to date, p_shop_id text default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  start_at timestamptz;
  end_at timestamptz;
begin
  if not blackbean_private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
    or p_to - p_from not between 0 and 365 then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;
  start_at := p_from::timestamp at time zone 'Europe/Kyiv';
  end_at := (p_to + 1)::timestamp at time zone 'Europe/Kyiv';

  return (
    with created as (
      select (created_at at time zone 'Europe/Kyiv')::date as day,
        count(*) as total,
        count(*) filter (where status in ('new', 'accepted', 'preparing', 'ready')) as active
      from public.orders
      where created_at >= start_at and created_at < end_at
        and (p_shop_id is null or shop_id = p_shop_id)
      group by 1
    ),
    paid as (
      select coalesce(sum(total_due_kopecks), 0) as revenue,
        coalesce(round(avg(total_due_kopecks)), 0) as average
      from public.orders
      where status = 'completed' and paid_at >= start_at and paid_at < end_at
        and (p_shop_id is null or shop_id = p_shop_id)
    )
    select jsonb_build_object(
      'revenue', paid.revenue, 'average', paid.average,
      'orders', coalesce((select sum(total) from created), 0),
      'active', coalesce((select sum(active) from created), 0),
      'days', (
        select jsonb_agg(jsonb_build_object('date', p_from + day_offset, 'count', coalesce(created.total, 0))
          order by day_offset)
        from generate_series(0, p_to - p_from) as days(day_offset)
        left join created on created.day = p_from + day_offset
      )
    )
    from paid
  );
end;
$$;

create function public.admin_customers(p_offset integer default 0, p_search text default '')
returns table (
  user_id uuid, email text, registered_at timestamptz, display_name text,
  contact_phone text, bonus_balance_kopecks bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not blackbean_private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_offset is null or p_offset < 0 or char_length(p_search) > 254 then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;
  return query
    select users.id, users.email::text, users.created_at, profiles.display_name,
      profiles.contact_phone, profiles.bonus_balance_kopecks
    from public.profiles
    join auth.users on users.id = profiles.user_id
    where users.email_confirmed_at is not null
      and (coalesce(p_search, '') = '' or strpos(lower(users.email), lower(p_search)) > 0
        or strpos(lower(profiles.display_name), lower(p_search)) > 0)
    order by users.created_at desc, users.id desc
    limit 21 offset p_offset;
end;
$$;

revoke all on function public.admin_access(), public.admin_dashboard(date, date, text),
  public.admin_customers(integer, text) from public, anon, authenticated, service_role;
grant execute on function public.admin_access(), public.admin_dashboard(date, date, text),
  public.admin_customers(integer, text) to authenticated;

create policy admin_bonus_read on public.bonus_transactions for select to authenticated
  using ((select blackbean_private.is_admin()));

do $$
declare
  target record;
begin
  for target in select * from (values
    ('products', 'price_kopecks'),
    ('product_variants', 'extra_kopecks'),
    ('modifiers', 'extra_kopecks'),
    ('shops', 'opens_at_minute, closes_at_minute'),
    ('shop_products', 'available')
  ) as permissions(relation, columns) loop
    execute format('grant update (%s) on public.%I to authenticated', target.columns, target.relation);
    execute format(
      'create policy admin_edit on public.%I for update to authenticated
        using ((select blackbean_private.is_admin())) with check ((select blackbean_private.is_admin()))',
      target.relation
    );
  end loop;
end;
$$;

grant insert (shop_id, product_id, available) on public.shop_products to authenticated;
create policy admin_add_availability on public.shop_products for insert to authenticated
  with check ((select blackbean_private.is_admin()));
