\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;

create function pg_temp.expect_error(command text, expected text)
returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected failure: %', expected;
exception when others then
  if sqlerrm <> expected then
    raise;
  end if;
end;
$$;

create function pg_temp.submit_order(key uuid, order_data jsonb, bonus integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result jsonb;
begin
  result := public.place_verified_order(
    auth.uid(), key, order_data, bonus, encode(sha256(gen_random_uuid()::text::bytea), 'hex')
  );
  if result ? 'error' then raise exception '%', result->>'error'; end if;
  return result->'receipt';
end;
$$;

do $$
declare
  customer uuid := gen_random_uuid();
  another_customer uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  guest_key uuid := gen_random_uuid();
  reserve_key uuid := gen_random_uuid();
  guest_order jsonb;
  espresso_order jsonb;
  receipt jsonb;
  guest_id uuid;
  paid_id uuid;
  reserved_id uuid;
  slot timestamptz;
  used_token text := encode(sha256(gen_random_uuid()::text::bytea), 'hex');
  rejected_token text := encode(sha256(gen_random_uuid()::text::bytea), 'hex');
begin
  assert (select count(*) from public.shops) = 3;
  assert (select count(*) from public.products) = 12;
  assert (select count(*) from public.product_variants) = 20;
  assert (select count(*) from public.modifiers) = 6;
  assert (select count(*) from public.shop_products where available) = 31;
  assert blackbean_private.resolve_pickup(
    'podil', '{"method":"pickup","timing":"asap"}', '2026-07-10T05:01:01Z'
  ) = '2026-07-10T05:17:00Z'::timestamptz;
  assert blackbean_private.resolve_pickup(
    'pechersk', '{"method":"pickup","timing":"scheduled","at":"2026-01-10T07:15:00Z"}', '2026-01-10T06:30:00Z'
  ) = '2026-01-10T07:15:00Z'::timestamptz;
  perform pg_temp.expect_error($test$
    select blackbean_private.resolve_pickup(
      'podil', '{"method":"pickup","timing":"asap"}', '2026-07-10T04:59:00Z'
    )
  $test$, 'PICKUP_UNAVAILABLE');
  assert blackbean_private.resolve_pickup(
    'podil', '{"method":"pickup","timing":"scheduled","at":"2026-07-11T05:15:00Z"}', '2026-07-10T16:44:00Z'
  ) = '2026-07-11T05:15:00Z'::timestamptz;
  perform pg_temp.expect_error($test$
    select blackbean_private.resolve_pickup(
      'podil', '{"method":"pickup","timing":"scheduled","at":"2026-07-10T17:00:00Z"}', '2026-07-10T16:44:00Z'
    )
  $test$, 'PICKUP_UNAVAILABLE');

  insert into auth.users (id, email, email_confirmed_at) values
    (customer, customer || '@example.invalid', now()),
    (another_customer, another_customer || '@example.invalid', now()),
    (admin, admin || '@example.invalid', now());
  insert into blackbean_private.admin_users values (admin);

  -- Use tomorrow so the slot remains available regardless of the test run time.
  slot := (date_trunc('day', clock_timestamp() at time zone 'Europe/Kyiv')
    + interval '1 day 8 hours 15 minutes') at time zone 'Europe/Kyiv';
  guest_order := jsonb_build_object(
    'shopId', 'center', 'pickup', jsonb_build_object('method', 'pickup', 'timing', 'scheduled',
      'at', to_char(slot at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
    'contact', jsonb_build_object('name', 'Олена', 'phone', '(067) 123‑45-67'),
    'items', '[{"productId":"cappuccino","variantId":"ml-250","modifierIds":["oat-milk","vanilla-syrup","extra-shot"],"quantity":2}]'::jsonb
  );
  espresso_order := jsonb_set(guest_order, '{items}',
    '[{"productId":"espresso","variantId":"ml-30","modifierIds":[],"quantity":1}]');

  assert to_regprocedure('public.place_order(uuid,jsonb,integer)') is null;
  assert has_function_privilege('service_role', 'public.place_verified_order(uuid,uuid,jsonb,integer,text)', 'execute');
  set local role anon;
  assert not has_function_privilege('public.place_verified_order(uuid,uuid,jsonb,integer,text)', 'execute');
  assert (select count(*) from public.products) = 12;
  assert not has_table_privilege('public.orders', 'select');
  assert not has_table_privilege('public.order_items', 'select');
  assert not has_table_privilege('public.profiles', 'select');
  assert not has_table_privilege('public.bonus_transactions', 'select');
  assert not has_table_privilege('public.products', 'update');
  assert not has_function_privilege('public.transition_order(uuid,public.order_status,public.order_status,boolean)', 'execute');
  assert not has_function_privilege('public.admin_access()', 'execute');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{items,0,price}', '1')), 'INVALID_ITEM');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{items,0,productId}', '"flat-white"')), 'PRODUCT_UNAVAILABLE');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{items,0,variantId}', '"ml-400"')), 'INVALID_VARIANT');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{items,0,modifierIds}', '["oat-milk","almond-milk"]')), 'INVALID_MODIFIERS');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(espresso_order, '{items,0,modifierIds}', '["extra-shot"]')), 'INVALID_MODIFIERS');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{items,0,quantity}', '21')), 'INVALID_ITEM');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    jsonb_set(guest_order, '{contact,phone}', '"+123"')), 'INVALID_PHONE');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L)',
    guest_order || jsonb_build_object('comment', repeat('a', 17000))), 'INVALID_ORDER');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L, 1)',
    guest_order), 'INVALID_BONUS_AMOUNT');

  receipt := pg_temp.submit_order(guest_key, guest_order);
  guest_id := (receipt->>'orderId')::uuid;
  assert (receipt->>'totalDueKopecks')::integer = 36000;
  assert (receipt->>'orderNumber') ~ '^BB-[0-9]{6}$';
  assert not receipt ? 'contact';
  assert pg_temp.submit_order(guest_key, guest_order) = receipt;
  perform pg_temp.expect_error(format('select pg_temp.submit_order(%L, %L)', guest_key, espresso_order),
    'IDEMPOTENCY_CONFLICT');
  reset role;

  assert (select user_id is null and contact_phone = '+380671234567' from public.orders where id = guest_id);
  assert (select order_number = receipt->>'orderNumber' from public.orders where id = guest_id);
  assert public.place_verified_order(null, guest_key, guest_order, 0, used_token)->'receipt' = receipt;
  assert public.place_verified_order(null, gen_random_uuid(), guest_order, 0, used_token)->>'error' = 'TURNSTILE_REUSED';
  assert public.place_verified_order(null, gen_random_uuid(),
    jsonb_set(guest_order, '{items,0,price}', '1'), 0, rejected_token)->>'error' = 'INVALID_ITEM';
  assert public.place_verified_order(null, gen_random_uuid(), guest_order, 0, rejected_token)->>'error' = 'TURNSTILE_REUSED';
  update public.products set price_kopecks = 12000 where id = 'cappuccino';
  assert (select base_price_kopecks = 10000 and variant_extra_kopecks = 2000
    and jsonb_array_length(modifiers) = 3 and line_total_kopecks = 36000
    from public.order_items where order_id = guest_id);

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', customer::text, true);
  assert not public.admin_access();
  assert not has_function_privilege('public.place_verified_order(uuid,uuid,jsonb,integer,text)', 'execute');
  perform pg_temp.expect_error('select public.admin_customers()', 'ADMIN_REQUIRED');
  perform pg_temp.expect_error('select public.admin_dashboard(current_date, current_date)', 'ADMIN_REQUIRED');
  update public.products set price_kopecks = 1 where id = 'espresso';
  assert not found;
  perform pg_temp.expect_error(format('select pg_temp.submit_order(%L, %L)', guest_key, guest_order),
    'IDEMPOTENCY_CONFLICT');
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L, 1)',
    espresso_order), 'INSUFFICIENT_BONUSES');
  receipt := pg_temp.submit_order(gen_random_uuid(), espresso_order);
  paid_id := (receipt->>'orderId')::uuid;
  assert (select count(*) from public.orders where id in (guest_id, paid_id)) = 1;
  assert (select count(*) from public.order_items where order_id in (guest_id, paid_id)) = 1;
  assert (select count(*) from public.profiles) = 1;
  update public.profiles set display_name = 'Олена', contact_phone = '+380500000001' where user_id = customer;
  assert (select contact_phone from public.profiles where user_id = customer) = '+380500000001';
  update public.profiles set contact_phone = '+380500000002' where user_id = another_customer;
  assert not found;
  assert not has_column_privilege('public.profiles', 'bonus_balance_kopecks', 'update');
  assert not has_column_privilege('public.profiles', 'user_id', 'update');
  assert not has_table_privilege('public.orders', 'insert,update,delete');
  assert not has_table_privilege('public.bonus_transactions', 'insert,update,delete');
  assert not has_schema_privilege('blackbean_private', 'usage');
  perform pg_temp.expect_error(format('select public.transition_order(%L, ''new'', ''accepted'')', paid_id),
    'ADMIN_REQUIRED');

  perform set_config('request.jwt.claim.sub', another_customer::text, true);
  assert (select contact_phone from public.profiles where user_id = another_customer) is null;
  assert not exists (select from public.orders where id in (guest_id, paid_id));
  assert not exists (select from public.order_items where order_id in (guest_id, paid_id));
  assert not exists (select from public.profiles where user_id = customer);

  perform set_config('request.jwt.claim.sub', admin::text, true);
  assert public.admin_access();
  assert exists (select from public.admin_customers(0, customer::text) where user_id = customer);
  assert (public.admin_dashboard((now() at time zone 'Europe/Kyiv')::date,
    (now() at time zone 'Europe/Kyiv')::date, 'center')->>'orders')::integer >= 2;
  assert (select count(*) from public.orders where id in (guest_id, paid_id)) = 2;
  perform pg_temp.expect_error(format('select public.transition_order(%L, ''new'', ''ready'')', paid_id),
    'INVALID_STATUS_TRANSITION');
  assert public.transition_order(paid_id, 'new', 'accepted') = 'accepted';
  assert public.transition_order(paid_id, 'accepted', 'preparing') = 'preparing';
  assert public.transition_order(paid_id, 'preparing', 'ready') = 'ready';
  perform pg_temp.expect_error(format('select public.transition_order(%L, ''ready'', ''completed'')', paid_id),
    'INVALID_PAYMENT_CONFIRMATION');
  assert public.transition_order(paid_id, 'ready', 'completed', true) = 'completed';
  perform pg_temp.expect_error(format('select public.transition_order(%L, ''ready'', ''completed'', true)', paid_id),
    'ORDER_STATUS_CONFLICT');
  assert (select paid_at is not null from public.orders where id = paid_id);

  perform set_config('request.jwt.claim.sub', customer::text, true);
  assert (select bonus_balance_kopecks from public.profiles) = 350;
  assert (select amount_kopecks from public.bonus_transactions where order_id = paid_id and kind = 'earn') = 350;
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L, 2101)',
    espresso_order), 'INVALID_BONUS_AMOUNT');
  receipt := pg_temp.submit_order(reserve_key, espresso_order, 300);
  reserved_id := (receipt->>'orderId')::uuid;
  assert (receipt->>'totalDueKopecks')::integer = 6700;
  assert pg_temp.submit_order(reserve_key, espresso_order, 300) = receipt;
  assert (select bonus_balance_kopecks from public.profiles) = 50;
  perform pg_temp.expect_error(format('select pg_temp.submit_order(gen_random_uuid(), %L, 300)',
    espresso_order), 'INSUFFICIENT_BONUSES');

  perform set_config('request.jwt.claim.sub', admin::text, true);
  assert public.transition_order(reserved_id, 'new', 'cancelled') = 'cancelled';
  perform pg_temp.expect_error(format('select public.transition_order(%L, ''new'', ''cancelled'')', reserved_id),
    'ORDER_STATUS_CONFLICT');
  perform set_config('request.jwt.claim.sub', customer::text, true);
  assert (select bonus_balance_kopecks from public.profiles) = 350;
  assert (select count(*) from public.bonus_transactions where order_id = reserved_id) = 2;
  assert (select sum(amount_kopecks) from public.bonus_transactions where order_id = reserved_id) = 0;
  perform set_config('request.jwt.claim.sub', another_customer::text, true);
  assert not exists (select from public.bonus_transactions where order_id in (paid_id, reserved_id));
  reset role;
end;
$$;

rollback;
select 'Black Bean order flow passed' as result;
