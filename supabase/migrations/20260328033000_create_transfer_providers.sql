create table if not exists public.transfer_providers (
  id text primary key,
  name text not null,
  logo_url text not null default '',
  tagline text not null default '',
  best_for text not null default '',
  availability_summary text not null default '',
  corridor_focus text not null default '',
  payout_networks text[] not null default '{}',
  strengths text[] not null default '{}',
  exchange_rate_score numeric not null default 0,
  exchange_rate numeric not null default 0,
  fee_score numeric not null default 0,
  speed_score numeric not null default 0,
  ease_score numeric not null default 0,
  efficiency_score numeric not null default 0,
  mobile_wallet_speed numeric not null default 0,
  bank_deposit_speed numeric not null default 0,
  referral_link text not null default '',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.transfer_providers
  add column if not exists logo_url text not null default '',
  add column if not exists tagline text not null default '',
  add column if not exists best_for text not null default '',
  add column if not exists availability_summary text not null default '',
  add column if not exists corridor_focus text not null default '',
  add column if not exists payout_networks text[] not null default '{}',
  add column if not exists strengths text[] not null default '{}',
  add column if not exists exchange_rate_score numeric not null default 0,
  add column if not exists exchange_rate numeric not null default 0,
  add column if not exists fee_score numeric not null default 0,
  add column if not exists speed_score numeric not null default 0,
  add column if not exists ease_score numeric not null default 0,
  add column if not exists efficiency_score numeric not null default 0,
  add column if not exists mobile_wallet_speed numeric not null default 0,
  add column if not exists bank_deposit_speed numeric not null default 0,
  add column if not exists referral_link text not null default '',
  add column if not exists sort_order integer not null default 100,
  add column if not exists active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists transfer_providers_name_idx on public.transfer_providers (name);
create index if not exists transfer_providers_sort_order_idx on public.transfer_providers (sort_order);

alter table public.transfer_providers enable row level security;

grant select on public.transfer_providers to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.transfer_providers from anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'transfer_providers'
      and policyname = 'Public can read transfer providers'
  ) then
    create policy "Public can read transfer providers"
      on public.transfer_providers
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

comment on table public.transfer_providers is 'Ranked diaspora transfer providers displayed on the compare homepage.';