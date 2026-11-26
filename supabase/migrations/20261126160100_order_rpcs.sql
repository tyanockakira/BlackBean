create function blackbean_private.resolve_pickup(
  p_shop_id text, p_pickup jsonb, p_now timestamptz
)
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  shop public.shops%rowtype;
  local_now timestamp := p_now at time zone 'Europe/Kyiv';
  midnight timestamp := date_trunc('day', local_now);
  opening timestamp;
  closing timestamp;
  earliest timestamp;
  pickup_at timestamptz;
  local_pickup timestamp;
begin
  if jsonb_typeof(p_pickup) is distinct from 'object' then
    raise exception 'INVALID_PICKUP';
  end if;
  if p_pickup - array['method', 'timing', 'at'] <> '{}'::jsonb
    or p_pickup->>'method' is distinct from 'pickup'
    or coalesce(p_pickup->>'timing', '') not in ('asap', 'scheduled') then
    raise exception 'INVALID_PICKUP';
  end if;

  select * into shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'UNKNOWN_SHOP';
  end if;
  opening := midnight + make_interval(mins => shop.opens_at_minute);
  closing := midnight + make_interval(mins => shop.closes_at_minute);
  earliest := greatest(opening, date_trunc('minute', local_now)
    + case when local_now = date_trunc('minute', local_now) then interval '0'
      else interval '1 minute' end) + interval '15 minutes';

  if earliest >= closing then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;
  if p_pickup->>'timing' = 'asap' then
    if local_now < opening then
      raise exception 'PICKUP_UNAVAILABLE';
    end if;
    return earliest at time zone 'Europe/Kyiv';
  end if;

  if coalesce(p_pickup->>'at', '') !~
    '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00([.]0{1,6})?(Z|[-+][0-9]{2}:[0-9]{2})$' then
    raise exception 'INVALID_PICKUP';
  end if;
  begin
    pickup_at := (p_pickup->>'at')::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow or invalid_time_zone_displacement_value then
    raise exception 'INVALID_PICKUP';
  end;
  local_pickup := pickup_at at time zone 'Europe/Kyiv';
  if local_pickup < earliest or local_pickup >= closing
    or extract(minute from local_pickup)::integer % 15 <> 0 then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;
  return pickup_at;
end;
$$;
revoke all on function blackbean_private.resolve_pickup(text, jsonb, timestamptz)
from public, anon, authenticated, service_role;

create function blackbean_private.price_items(p_shop_id text, p_items jsonb)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  item jsonb;
  snapshots jsonb := '[]';
  seen_configurations jsonb := '[]';
  item_configuration text;
  product public.products%rowtype;
  variant public.product_variants%rowtype;
  item_quantity integer;
  total_quantity integer := 0;
  selected_modifiers jsonb;
  modifier_cost integer;
  matched_count integer;
  group_count integer;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'INVALID_ITEMS';
  end if;
  if jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'INVALID_ITEMS';
  end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'INVALID_ITEM';
    end if;
    if item - array['productId', 'variantId', 'modifierIds', 'quantity'] <> '{}'::jsonb
      or jsonb_typeof(item->'productId') is distinct from 'string'
      or jsonb_typeof(item->'variantId') is distinct from 'string'
      or jsonb_typeof(item->'modifierIds') is distinct from 'array'
      or jsonb_typeof(item->'quantity') is distinct from 'number'
      or item->>'quantity' !~ '^([1-9]|1[0-9]|20)$' then
      raise exception 'INVALID_ITEM';
    end if;
    if jsonb_array_length(item->'modifierIds') > 3 then
      raise exception 'INVALID_MODIFIERS';
    end if;
    item_quantity := (item->>'quantity')::integer;
    total_quantity := total_quantity + item_quantity;
    if total_quantity > 100 then
      raise exception 'TOO_MANY_UNITS';
    end if;

    select p.* into product
    from public.products p
    join public.shop_products sp on sp.product_id = p.id
    where p.id = item->>'productId' and sp.shop_id = p_shop_id and sp.available;
    if not found then
      raise exception 'PRODUCT_UNAVAILABLE';
    end if;

    select * into variant from public.product_variants
    where product_id = product.id and id = item->>'variantId';
    if not found then
      raise exception 'INVALID_VARIANT';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'groupId', m.group_id, 'name', m.name, 'extraKopecks', m.extra_kopecks
    ) order by m.id), '[]'), coalesce(sum(m.extra_kopecks), 0),
      count(*), count(distinct m.group_id)
    into selected_modifiers, modifier_cost, matched_count, group_count
    from jsonb_array_elements(item->'modifierIds') as choice(id)
    join public.modifiers m on to_jsonb(m.id) = choice.id
    join public.product_modifier_groups g on g.group_id = m.group_id and g.product_id = product.id;

    if matched_count <> jsonb_array_length(item->'modifierIds') or group_count <> matched_count then
      raise exception 'INVALID_MODIFIERS';
    end if;

    item_configuration := jsonb_build_array(product.id, variant.id, selected_modifiers)::text;
    if seen_configurations ? item_configuration then
      raise exception 'DUPLICATE_ITEM';
    end if;
    seen_configurations := seen_configurations || jsonb_build_array(item_configuration);

    snapshots := snapshots || jsonb_build_array(jsonb_build_object(
      'product_id', product.id, 'product_name', product.name, 'base_price_kopecks', product.price_kopecks,
      'variant_id', variant.id, 'variant_name', variant.name, 'variant_extra_kopecks', variant.extra_kopecks,
      'modifiers', selected_modifiers, 'quantity', item_quantity,
      'unit_price_kopecks', product.price_kopecks + variant.extra_kopecks + modifier_cost
    ));
  end loop;
  return snapshots;
end;
$$;
revoke all on function blackbean_private.price_items(text, jsonb)
from public, anon, authenticated, service_role;

create function public.place_order(
  p_idempotency_key uuid, p_order jsonb, p_bonus_kopecks integer default 0
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_digest bytea;
  contact jsonb;
  customer_name text;
  phone text;
  normalized_phone text;
  order_comment text;
  shop_id text;
  order_lines jsonb;
  subtotal bigint;
  pickup_at timestamptz;
  receipt public.orders%rowtype;
begin
  if p_idempotency_key is null
    or p_idempotency_key::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if jsonb_typeof(p_order) is distinct from 'object'
    or octet_length(p_order::text) > 16384
    or p_bonus_kopecks is null or p_bonus_kopecks < 0 then
    raise exception 'INVALID_ORDER';
  end if;

  request_digest := sha256(convert_to(jsonb_build_array(p_order, p_bonus_kopecks)::text, 'UTF8'));

  -- Serialize same-key requests before checking for an existing receipt.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into receipt from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if receipt.user_id is distinct from actor_id or receipt.request_hash <> request_digest then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
  else
    contact := p_order->'contact';
    if p_order - array['shopId', 'items', 'pickup', 'contact', 'comment'] <> '{}'::jsonb
      or jsonb_typeof(contact) is distinct from 'object'
      or jsonb_typeof(p_order->'shopId') is distinct from 'string'
      or (p_order ? 'comment' and jsonb_typeof(p_order->'comment') <> 'string') then
      raise exception 'INVALID_ORDER';
    end if;
    if contact - array['name', 'phone'] <> '{}'::jsonb
      or jsonb_typeof(contact->'name') is distinct from 'string'
      or jsonb_typeof(contact->'phone') is distinct from 'string' then
      raise exception 'INVALID_CONTACT';
    end if;

    customer_name := btrim(regexp_replace(contact->>'name', '[[:space:]]+', ' ', 'g'));
    if char_length(customer_name) > 70 or customer_name !~ '[[:alpha:]]' then
      raise exception 'INVALID_NAME';
    end if;
    phone := contact->>'phone';
    normalized_phone := regexp_replace(phone, '[[:space:]()‐‑-]', '', 'g');
    if char_length(phone) > 30 or normalized_phone !~ '^(\+?38)?0[0-9]{9}$' then
      raise exception 'INVALID_PHONE';
    end if;
    normalized_phone := '+38' || right(normalized_phone, 10);
    order_comment := regexp_replace(coalesce(p_order->>'comment', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if char_length(order_comment) > 300 then
      raise exception 'INVALID_COMMENT';
    end if;

    shop_id := p_order->>'shopId';
    order_lines := blackbean_private.price_items(shop_id, p_order->'items');
    select sum((line->>'unit_price_kopecks')::bigint * (line->>'quantity')::integer)
    into subtotal from jsonb_array_elements(order_lines) as item(line);

    if p_bonus_kopecks > 0 then
      if actor_id is null or p_bonus_kopecks > subtotal * 30 / 100 then
        raise exception 'INVALID_BONUS_AMOUNT';
      end if;
      -- Recheck balance after a competing reservation releases the profile row.
      update public.profiles set bonus_balance_kopecks = bonus_balance_kopecks - p_bonus_kopecks
      where user_id = actor_id and bonus_balance_kopecks >= p_bonus_kopecks;
      if not found then
        raise exception 'INSUFFICIENT_BONUSES';
      end if;
    end if;

    pickup_at := blackbean_private.resolve_pickup(shop_id, p_order->'pickup', clock_timestamp());
    insert into public.orders (
      user_id, shop_id, pickup_timing, pickup_at, contact_name, contact_phone, comment,
      subtotal_kopecks, bonus_used_kopecks, idempotency_key, request_hash
    ) values (
      actor_id, shop_id, p_order->'pickup'->>'timing', pickup_at, customer_name, normalized_phone,
      order_comment, subtotal, p_bonus_kopecks, p_idempotency_key, request_digest
    ) returning * into receipt;

    insert into public.order_items
      (order_id, line_number, product_id, product_name, base_price_kopecks, variant_id,
        variant_name, variant_extra_kopecks, modifiers, unit_price_kopecks, quantity)
    select receipt.id, line_number, product_id, product_name, base_price_kopecks, variant_id,
      variant_name, variant_extra_kopecks, modifiers, unit_price_kopecks, quantity
    from rows from (jsonb_to_recordset(order_lines) as (
      product_id text, product_name text, base_price_kopecks integer, variant_id text,
      variant_name text, variant_extra_kopecks integer, modifiers jsonb, unit_price_kopecks integer,
      quantity integer
    )) with ordinality as item(
      product_id, product_name, base_price_kopecks, variant_id, variant_name, variant_extra_kopecks,
      modifiers, unit_price_kopecks, quantity, line_number
    );

    if p_bonus_kopecks > 0 then
      insert into public.bonus_transactions (order_id, kind, user_id, amount_kopecks)
      values (receipt.id, 'reserve', actor_id, -p_bonus_kopecks);
    end if;
  end if;

  return jsonb_build_object(
    'orderId', receipt.id, 'pickupAt', receipt.pickup_at,
    'subtotalKopecks', receipt.subtotal_kopecks, 'bonusUsedKopecks', receipt.bonus_used_kopecks,
    'totalDueKopecks', receipt.total_due_kopecks
  );
end;
$$;
revoke all on function public.place_order(uuid, jsonb, integer)
from public, anon, authenticated, service_role;
grant execute on function public.place_order(uuid, jsonb, integer) to anon, authenticated;

create function public.transition_order(
  p_order_id uuid, p_expected_status public.order_status, p_next_status public.order_status,
  p_payment_confirmed boolean default false
)
returns public.order_status
language plpgsql security definer set search_path = ''
as $$
declare
  current_order public.orders%rowtype;
  bonus_amount bigint := 0;
  bonus_kind text;
  changed_at timestamptz;
begin
  if not blackbean_private.is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into current_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if current_order.status is distinct from p_expected_status then
    raise exception 'ORDER_STATUS_CONFLICT';
  end if;
  if not coalesce(case current_order.status
    when 'new' then p_next_status in ('accepted', 'cancelled')
    when 'accepted' then p_next_status in ('preparing', 'cancelled')
    when 'preparing' then p_next_status in ('ready', 'cancelled')
    when 'ready' then p_next_status in ('completed', 'cancelled')
    else false
  end, false) then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;
  if p_payment_confirmed is distinct from (p_next_status = 'completed') then
    raise exception 'INVALID_PAYMENT_CONFIRMATION';
  end if;

  if current_order.user_id is not null then
    if p_next_status = 'completed' then
      bonus_amount := current_order.subtotal_kopecks * 5 / 100;
      bonus_kind := 'earn';
    elsif p_next_status = 'cancelled' then
      bonus_amount := current_order.bonus_used_kopecks;
      bonus_kind := 'return';
    end if;
    if bonus_amount > 0 then
      update public.profiles set bonus_balance_kopecks = bonus_balance_kopecks + bonus_amount
      where user_id = current_order.user_id;
      insert into public.bonus_transactions (order_id, kind, user_id, amount_kopecks)
      values (current_order.id, bonus_kind, current_order.user_id, bonus_amount);
    end if;
  end if;

  changed_at := clock_timestamp();
  update public.orders set status = p_next_status, updated_at = changed_at,
    paid_at = case when p_next_status = 'completed' then changed_at end
  where id = current_order.id;
  return p_next_status;
end;
$$;
revoke all on function public.transition_order(uuid, public.order_status, public.order_status, boolean)
from public, anon, authenticated, service_role;
grant execute on function public.transition_order(uuid, public.order_status, public.order_status, boolean)
to authenticated;
