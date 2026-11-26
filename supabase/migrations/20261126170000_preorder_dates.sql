alter table public.shops drop constraint if exists shops_check;
alter table public.shops add constraint shops_hours_check check (
  opens_at_minute between 0 and 1439
  and closes_at_minute between 0 and 2880
  and (case when closes_at_minute <= opens_at_minute
    then closes_at_minute + 1440 else closes_at_minute end) > opens_at_minute + 15
  and closes_at_minute <= opens_at_minute + 1440
);

create or replace function blackbean_private.resolve_pickup(
  p_shop_id text, p_pickup jsonb, p_now timestamptz
)
returns timestamptz
language plpgsql stable set search_path = ''
as $$
declare
  shop public.shops%rowtype;
  local_now timestamp := p_now at time zone 'Europe/Kyiv';
  local_pickup timestamp;
  schedule_day date;
  opening timestamp;
  closing timestamp;
  earliest timestamp;
  pickup_at timestamptz;
  closes integer;
begin
  if jsonb_typeof(p_pickup) is distinct from 'object'
    or p_pickup - array['method', 'timing', 'at'] <> '{}'::jsonb
    or p_pickup->>'method' is distinct from 'pickup'
    or coalesce(p_pickup->>'timing', '') not in ('asap', 'scheduled') then
    raise exception 'INVALID_PICKUP';
  end if;

  select * into shop from public.shops where id = p_shop_id;
  if not found then raise exception 'UNKNOWN_SHOP'; end if;
  closes := case when shop.closes_at_minute <= shop.opens_at_minute
    then shop.closes_at_minute + 1440 else shop.closes_at_minute end;

  if p_pickup->>'timing' = 'asap' then
    schedule_day := local_now::date;
    opening := schedule_day + make_interval(mins => shop.opens_at_minute);
    closing := schedule_day + make_interval(mins => closes);
    earliest := greatest(opening, date_trunc('minute', local_now)
      + case when local_now = date_trunc('minute', local_now) then interval '0'
        else interval '1 minute' end) + interval '15 minutes';
    if local_now < opening or earliest >= closing then raise exception 'PICKUP_UNAVAILABLE'; end if;
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
  if local_pickup::date not between local_now::date and local_now::date + 1 then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;

  schedule_day := local_pickup::date;
  if shop.closes_at_minute <= shop.opens_at_minute
    and extract(hour from local_pickup) * 60 + extract(minute from local_pickup) < shop.closes_at_minute then
    schedule_day := schedule_day - 1;
  end if;
  opening := schedule_day + make_interval(mins => shop.opens_at_minute);
  closing := schedule_day + make_interval(mins => closes);
  earliest := opening + interval '15 minutes';
  if local_pickup::date = local_now::date then
    earliest := greatest(earliest, date_trunc('minute', local_now)
      + case when local_now = date_trunc('minute', local_now) then interval '0'
        else interval '1 minute' end + interval '15 minutes');
  end if;
  if local_pickup < earliest or local_pickup >= closing
    or mod(extract(epoch from (local_pickup - opening))::integer / 60, 15) <> 0 then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;
  return pickup_at;
end;
$$;

revoke all on function blackbean_private.resolve_pickup(text, jsonb, timestamptz)
from public, anon, authenticated, service_role;
