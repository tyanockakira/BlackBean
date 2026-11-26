\set ON_ERROR_STOP on
begin;
set local plpgsql.check_asserts = on;

create function pg_temp.expect_error(command text, expected text)
returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected failure: %', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end;
$$;

do $$
declare
  now_at timestamptz := ('2026-11-26 12:00:00'::timestamp at time zone 'Europe/Kyiv');
  tomorrow_slot timestamptz := ('2026-11-27 08:15:00'::timestamp at time zone 'Europe/Kyiv');
  overnight_slot timestamptz := ('2026-11-27 00:15:00'::timestamp at time zone 'Europe/Kyiv');
begin
  perform pg_temp.expect_error($q$select blackbean_private.resolve_pickup(
    'podil', '{"method":"pickup","timing":"asap"}', '2026-11-26 20:00:00+02'
  )$q$, 'PICKUP_UNAVAILABLE');
  assert blackbean_private.resolve_pickup(
    'podil', jsonb_build_object('method','pickup','timing','scheduled','at',tomorrow_slot), now_at
  ) = tomorrow_slot;
  perform pg_temp.expect_error($q$select blackbean_private.resolve_pickup(
    'podil', jsonb_build_object('method','pickup','timing','scheduled','at',
      ('2026-11-28 08:15:00'::timestamp at time zone 'Europe/Kyiv')), '2026-11-26 12:00:00+02'
  )$q$, 'PICKUP_UNAVAILABLE');

  insert into public.shops(id, name, district, opens_at_minute, closes_at_minute)
  values ('night-test', 'Night test', 'Test', 1380, 60);
  assert blackbean_private.resolve_pickup(
    'night-test', jsonb_build_object('method','pickup','timing','scheduled','at',overnight_slot), now_at
  ) = overnight_slot;
end;
$$;

rollback;
select 'Black Bean preorder date tests passed' as result;
