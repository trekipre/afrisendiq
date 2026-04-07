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

create index if not exists inbound_webhook_events_provider_idx
  on public.inbound_webhook_events (provider, received_at desc);

alter table public.inbound_webhook_events enable row level security;

revoke all on public.inbound_webhook_events from anon, authenticated;
grant select, insert, update on public.inbound_webhook_events to service_role;

comment on table public.inbound_webhook_events is 'Canonical inbound webhook receipts for payment and provider callbacks.';