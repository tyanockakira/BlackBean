alter table public.profiles add column contact_phone text
  check (contact_phone ~ '^\+380[0-9]{9}$');

grant update (contact_phone) on public.profiles to authenticated;
