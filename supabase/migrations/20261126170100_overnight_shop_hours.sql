alter table public.shops drop constraint if exists shops_hours_check;
alter table public.shops add constraint shops_hours_check check (
  opens_at_minute between 0 and 1439
  and closes_at_minute between 0 and 2880
  and (case when closes_at_minute <= opens_at_minute
    then closes_at_minute + 1440 else closes_at_minute end) > opens_at_minute + 15
  and (case when closes_at_minute <= opens_at_minute
    then closes_at_minute + 1440 else closes_at_minute end) <= opens_at_minute + 1440
);
