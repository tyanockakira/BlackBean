drop function public.place_order(uuid, jsonb, integer);

create function blackbean_private.place_order(
  p_actor_id uuid, p_idempotency_key uuid, p_order jsonb, p_bonus_kopecks integer default 0
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := p_actor_id;
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
    'orderId', receipt.id, 'orderNumber', receipt.order_number, 'pickupAt', receipt.pickup_at,
    'subtotalKopecks', receipt.subtotal_kopecks, 'bonusUsedKopecks', receipt.bonus_used_kopecks,
    'totalDueKopecks', receipt.total_due_kopecks
  );
end;
$$;

revoke all on function blackbean_private.place_order(uuid, uuid, jsonb, integer)
  from public, anon, authenticated, service_role;

create table blackbean_private.order_challenges (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  used_at timestamptz not null default now()
);
create index order_challenges_used_at_idx on blackbean_private.order_challenges (used_at);
alter table blackbean_private.order_challenges enable row level security;
revoke all on blackbean_private.order_challenges from public, anon, authenticated, service_role;

create function public.place_verified_order(
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_order jsonb,
  p_bonus_kopecks integer,
  p_token_hash text
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Siteverify tokens expire after five minutes. Keep their hashes longer than that.
  delete from blackbean_private.order_challenges where used_at < now() - interval '10 minutes';
  insert into blackbean_private.order_challenges (token_hash) values (p_token_hash)
  on conflict do nothing;
  if not found then
    return jsonb_build_object('error', 'TURNSTILE_REUSED');
  end if;

  -- The server verifies the caller with Supabase Auth; the client cannot choose this ID.
  begin
    return jsonb_build_object('receipt', blackbean_private.place_order(p_actor_id, p_idempotency_key, p_order, p_bonus_kopecks));
  exception when raise_exception then
    -- A rejected order still consumes its challenge.
    return jsonb_build_object('error', sqlerrm);
  end;
end;
$$;

revoke all on function public.place_verified_order(uuid, uuid, jsonb, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.place_verified_order(uuid, uuid, jsonb, integer, text) to service_role;
