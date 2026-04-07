create table if not exists public.manual_billing_recipient_profiles (
  id text primary key,
  owner_email text not null,
  service text not null check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus')),
  country_code text not null check (country_code in ('CI')),
  recipient_name text not null,
  account_reference text not null,
  normalized_account_reference text not null,
  phone text,
  normalized_phone text,
  preferred_delivery_channel text not null default 'sms' check (preferred_delivery_channel in ('sms', 'whatsapp', 'in_app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_billing_recipient_profiles_owner_email_idx
  on public.manual_billing_recipient_profiles (owner_email, updated_at desc);

create index if not exists manual_billing_recipient_profiles_lookup_idx
  on public.manual_billing_recipient_profiles (owner_email, service, normalized_account_reference, normalized_phone);

alter table if exists public.manual_billing_recipient_profiles enable row level security;
revoke all on table public.manual_billing_recipient_profiles from anon, authenticated;

comment on table public.manual_billing_recipient_profiles is 'Saved AfriSendIQ manual-billing recipients used for repeat electricity flows and delivery target resolution.';