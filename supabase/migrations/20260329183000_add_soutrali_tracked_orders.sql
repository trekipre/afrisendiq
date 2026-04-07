create table if not exists public.soutrali_tracked_orders (
  id text primary key,
  trace_id text not null,
  product_id text not null,
  product_name text not null,
  category text not null check (category in ('airtime', 'data', 'electricity', 'gift-card')),
  brand text not null check (brand in ('MTN', 'MOOV', 'ORANGE', 'CIE', 'JUMIA')),
  amount numeric not null,
  quoted_price numeric not null,
  currency text not null default 'XOF' check (currency = 'XOF'),
  customer_reference text not null,
  recipient_label text not null,
  beneficiary_phone_number text,
  recipient_email text,
  payment_session_id text,
  payment_status text check (payment_status in ('pending', 'paid', 'refunded')),
  selected_provider text not null check (selected_provider in ('reloadly', 'ding', 'dtone')),
  selected_execution_mode text not null check (selected_execution_mode in ('live', 'simulated')),
  provider_external_id text,
  provider_status text,
  recharge_code text,
  failure_reason text,
  return_path text not null,
  status text not null check (status in ('created', 'payment_pending', 'payment_received', 'provider_processing', 'completed', 'code_ready', 'refunded', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists soutrali_tracked_orders_trace_id_idx on public.soutrali_tracked_orders (trace_id);
create index if not exists soutrali_tracked_orders_status_idx on public.soutrali_tracked_orders (status);
create index if not exists soutrali_tracked_orders_category_idx on public.soutrali_tracked_orders (category);
create index if not exists soutrali_tracked_orders_created_at_idx on public.soutrali_tracked_orders (created_at desc);

alter table public.soutrali_tracked_orders enable row level security;
revoke all on public.soutrali_tracked_orders from anon, authenticated;

comment on table public.soutrali_tracked_orders is 'Durable Stripe-first Soutrali checkout orders used by customer-facing Cote d''Ivoire flows.';