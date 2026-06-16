create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  created_at timestamptz default now()
);

create table public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid unique references profiles(id) on delete cascade,
  name          text not null,
  slug          text unique not null,
  plan          text check (plan in ('starter', 'pro')) default null,
  trial_ends_at timestamptz not null,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.stores enable row level security;

create policy "profiles: own row only" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

create policy "stores: own store only" on public.stores for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "stores: slug lookup public" on public.stores for select using (true);

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.stores to authenticated;
grant select on public.stores to anon;