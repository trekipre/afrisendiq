create table if not exists public.onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected')),
  current_step integer not null default 0 check (current_step between 0 and 5),
  email text,
  phone text,
  legal_first_name text,
  legal_last_name text,
  country_of_residence text not null default 'United States',
  date_of_birth date,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text not null default 'US',
  auth_preference text not null default 'passkey' check (auth_preference in ('passkey', 'email_magic_link', 'sms_otp')),
  enable_trusted_device boolean not null default true,
  draft_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists onboarding_drafts_email_idx on public.onboarding_drafts (email);
create index if not exists onboarding_drafts_phone_idx on public.onboarding_drafts (phone);
create index if not exists onboarding_drafts_updated_at_idx on public.onboarding_drafts (updated_at desc);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone_e164 text unique,
  status text not null default 'prospect' check (status in ('prospect', 'active', 'restricted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_drafts
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create table if not exists public.customer_profiles (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  legal_first_name text not null,
  legal_last_name text not null,
  date_of_birth date,
  country_of_residence text not null,
  citizenship_country text,
  tax_id_last4 text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country_code text,
  address_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_contact_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  type text not null check (type in ('email', 'phone')),
  value text not null,
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists customer_contact_methods_customer_id_idx on public.customer_contact_methods (customer_id);
create unique index if not exists customer_contact_methods_customer_type_value_idx on public.customer_contact_methods (customer_id, type, value);

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  device_label text,
  device_fingerprint text not null,
  last_ip inet,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trusted_devices_customer_id_idx on public.trusted_devices (customer_id);

create table if not exists public.auth_factors (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  factor_type text not null check (factor_type in ('passkey', 'email_magic_link', 'sms_otp', 'totp')),
  status text not null check (status in ('pending', 'verified', 'revoked')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_factors_customer_id_idx on public.auth_factors (customer_id);
create unique index if not exists auth_factors_customer_factor_type_idx on public.auth_factors (customer_id, factor_type);

create table if not exists public.customer_limits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  onboarding_draft_id uuid unique references public.onboarding_drafts(id) on delete cascade,
  tier text not null,
  limit_currency text not null default 'USD',
  per_transaction_limit numeric not null,
  daily_amount_limit numeric not null,
  monthly_amount_limit numeric not null,
  updated_at timestamptz not null default now(),
  check (customer_id is not null or onboarding_draft_id is not null)
);

create table if not exists public.customer_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  onboarding_draft_id uuid unique references public.onboarding_drafts(id) on delete cascade,
  risk_level text not null,
  risk_score numeric not null default 0,
  pep_hit boolean not null default false,
  sanctions_hit boolean not null default false,
  device_risk_score numeric not null default 0,
  requires_step_up boolean not null default false,
  step_up_reason text,
  updated_at timestamptz not null default now(),
  check (customer_id is not null or onboarding_draft_id is not null)
);

create unique index if not exists customer_limits_customer_id_idx on public.customer_limits (customer_id);
create unique index if not exists customer_risk_profiles_customer_id_idx on public.customer_risk_profiles (customer_id);

create table if not exists public.sanctions_screenings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  onboarding_draft_id uuid references public.onboarding_drafts(id) on delete cascade,
  screening_provider text,
  screening_type text not null,
  status text not null check (status in ('clear', 'potential_match', 'needs_review')),
  match_score numeric,
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id is not null or onboarding_draft_id is not null)
);

create index if not exists sanctions_screenings_draft_idx on public.sanctions_screenings (onboarding_draft_id, created_at desc);

create table if not exists public.compliance_cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  onboarding_draft_id uuid references public.onboarding_drafts(id) on delete cascade,
  order_id text,
  reason text not null,
  status text not null check (status in ('open', 'pending_review', 'needs_customer_action', 'resolved', 'closed_no_issue')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  decision text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_cases_draft_idx on public.compliance_cases (onboarding_draft_id);
create index if not exists compliance_cases_status_idx on public.compliance_cases (status);

create table if not exists public.case_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.compliance_cases(id) on delete cascade,
  actor_type text not null check (actor_type in ('system', 'admin', 'customer')),
  actor_id text,
  action text not null,
  notes text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_actions_case_id_idx on public.case_actions (case_id);

create table if not exists public.inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  signature_valid boolean not null,
  event_type text not null,
  domain_type text not null,
  domain_reference text,
  order_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists inbound_webhook_events_provider_idx on public.inbound_webhook_events (provider, received_at desc);

alter table public.onboarding_drafts enable row level security;
alter table public.customers enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.customer_contact_methods enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.auth_factors enable row level security;
alter table public.customer_limits enable row level security;
alter table public.customer_risk_profiles enable row level security;
alter table public.sanctions_screenings enable row level security;
alter table public.compliance_cases enable row level security;
alter table public.case_actions enable row level security;
alter table public.inbound_webhook_events enable row level security;

revoke all on public.onboarding_drafts from anon, authenticated;
revoke all on public.customers from anon, authenticated;
revoke all on public.customer_profiles from anon, authenticated;
revoke all on public.customer_contact_methods from anon, authenticated;
revoke all on public.trusted_devices from anon, authenticated;
revoke all on public.auth_factors from anon, authenticated;
revoke all on public.customer_limits from anon, authenticated;
revoke all on public.customer_risk_profiles from anon, authenticated;
revoke all on public.sanctions_screenings from anon, authenticated;
revoke all on public.compliance_cases from anon, authenticated;
revoke all on public.case_actions from anon, authenticated;
revoke all on public.inbound_webhook_events from anon, authenticated;

grant select, insert, update on public.onboarding_drafts to service_role;
grant select, insert, update on public.customers to service_role;
grant select, insert, update on public.customer_profiles to service_role;
grant select, insert, update on public.customer_contact_methods to service_role;
grant select, insert, update on public.trusted_devices to service_role;
grant select, insert, update on public.auth_factors to service_role;
grant select, insert, update on public.customer_limits to service_role;
grant select, insert, update on public.customer_risk_profiles to service_role;
grant select, insert, update on public.sanctions_screenings to service_role;
grant select, insert, update on public.compliance_cases to service_role;
grant select, insert, update on public.case_actions to service_role;
grant select, insert, update on public.inbound_webhook_events to service_role;
