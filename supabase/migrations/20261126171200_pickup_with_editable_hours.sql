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
    if closes > 1440 and local_now < schedule_day + make_interval(mins => closes - 1440) then
      schedule_day := schedule_day - 1;
    end if;
    opening := schedule_day + make_interval(mins => shop.opens_at_minute);
    closing := schedule_day + make_interval(mins => closes);
    earliest := greatest(opening, date_trunc('minute', local_now)
      + case when local_now = date_trunc('minute', local_now) then interval '0'
        else interval '1 minute' end) + interval '15 minutes';
    if local_now < opening or earliest >= closing or earliest::date <> local_now::date then
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
  if local_pickup::date not between local_now::date and local_now::date + 1 then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;

  schedule_day := local_pickup::date;
  if closes > 1440 and local_pickup < schedule_day + make_interval(mins => closes - 1440) then
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
  if pickup_at <= p_now or local_pickup < earliest or local_pickup > closing - interval '15 minutes'
    or mod(extract(epoch from (local_pickup - opening))::integer / 60, 15) <> 0 then
    raise exception 'PICKUP_UNAVAILABLE';
  end if;
  return pickup_at;
end;
$$;

revoke all on function blackbean_private.resolve_pickup(text, jsonb, timestamptz)
from public, anon, authenticated, service_role;
