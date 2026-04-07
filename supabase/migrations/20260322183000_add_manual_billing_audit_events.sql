create table if not exists public.manual_billing_audit_events (
  id text primary key,
  order_id text not null references public.manual_billing_orders(id) on delete cascade,
  trace_id text not null,
  service text not null check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus')),
  channel text not null check (channel in ('stripe_webhook', 'telegram_send', 'telegram_callback', 'whatsapp_send', 'admin', 'automation', 'system')),
  event text not null,
  outcome text not null check (outcome in ('attempted', 'received', 'processed', 'delivered', 'duplicate', 'failed', 'skipped')),
  detail text,
  payload jsonb,
  recorded_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists manual_billing_audit_events_order_id_idx on public.manual_billing_audit_events (order_id);
create index if not exists manual_billing_audit_events_trace_id_idx on public.manual_billing_audit_events (trace_id);
create index if not exists manual_billing_audit_events_channel_idx on public.manual_billing_audit_events (channel);
create index if not exists manual_billing_audit_events_recorded_at_idx on public.manual_billing_audit_events (recorded_at desc);

alter table public.manual_billing_audit_events enable row level security;

comment on table public.manual_billing_audit_events is 'Queryable audit evidence for manual billing webhook, Telegram, admin, and automation events.';
