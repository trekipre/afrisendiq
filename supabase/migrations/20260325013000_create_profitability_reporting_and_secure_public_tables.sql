alter table if exists public.jit_orders enable row level security;
alter table if exists public.settlements enable row level security;
alter table if exists public.guard_audit enable row level security;
alter table if exists public.webhook_events enable row level security;
alter table if exists public.manual_billing_orders enable row level security;
alter table if exists public.manual_billing_audit_events enable row level security;

revoke all on table public.jit_orders from anon, authenticated;
revoke all on table public.settlements from anon, authenticated;
revoke all on table public.guard_audit from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.manual_billing_orders from anon, authenticated;
revoke all on table public.manual_billing_audit_events from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'transfer_providers' and c.relkind = 'r'
  ) then
    execute 'alter table public.transfer_providers enable row level security';
    execute 'grant select on public.transfer_providers to anon, authenticated';
    execute 'revoke insert, update, delete, truncate, references, trigger on public.transfer_providers from anon, authenticated';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'transfer_providers'
        and policyname = 'Public can read transfer providers'
    ) then
      execute 'create policy "Public can read transfer providers" on public.transfer_providers for select to anon, authenticated using (true)';
    end if;
  end if;
end $$;

create or replace view public.profitability_reporting
with (security_invoker = true) as
with latest_settlement as (
  select distinct on (s.order_id)
    s.order_id,
    s.trace_id,
    s.pricing_input_amount,
    s.pricing_provider_cost,
    s.pricing_customer_price,
    s.pricing_margin,
    s.pricing_margin_percent,
    s.pricing_gross_margin,
    s.pricing_gross_margin_percent,
    s.pricing_operating_cost,
    s.pricing_net_margin_after_fees,
    s.provider,
    s.pricing_strategy,
    s.pricing_decision,
    s.settled_at
  from public.settlements s
  order by s.order_id, s.settled_at desc
)
select
  'jit'::text as flow_type,
  j.id as order_id,
  j.trace_id,
  j.product_type as service_category,
  j.product_id as service_reference,
  j.customer_reference,
  j.recipient_label,
  null::text as customer_name,
  null::text as customer_email,
  j.status,
  j.currency,
  coalesce(ls.pricing_input_amount, j.pricing_input_amount, j.amount) as input_amount,
  coalesce(ls.pricing_provider_cost, j.pricing_provider_cost, j.provider_cost) as provider_cost,
  coalesce(ls.pricing_customer_price, j.pricing_customer_price, j.quoted_price) as customer_price,
  coalesce(ls.pricing_margin, j.pricing_margin, j.margin) as net_margin,
  coalesce(ls.pricing_margin_percent, j.pricing_margin_percent) as net_margin_percent,
  coalesce(ls.pricing_gross_margin, j.pricing_gross_margin) as gross_margin,
  coalesce(ls.pricing_gross_margin_percent, j.pricing_gross_margin_percent) as gross_margin_percent,
  coalesce(ls.pricing_operating_cost, j.pricing_operating_cost) as operating_cost,
  coalesce(ls.pricing_net_margin_after_fees, j.pricing_net_margin_after_fees) as net_margin_after_fees,
  coalesce(ls.provider, j.selected_provider) as provider,
  coalesce(ls.pricing_strategy, j.pricing_strategy) as pricing_strategy,
  coalesce(ls.pricing_decision, j.pricing_decision) as pricing_decision,
  j.failure_reason,
  ls.settled_at as realized_at,
  j.created_at,
  j.updated_at,
  (j.status = 'settled') as realized
from public.jit_orders j
left join latest_settlement ls on ls.order_id = j.id

union all

select
  'manual_billing'::text as flow_type,
  m.id as order_id,
  m.trace_id,
  m.service as service_category,
  coalesce(m.package_code, m.account_reference) as service_reference,
  m.account_reference as customer_reference,
  coalesce(m.customer ->> 'recipientName', m.account_reference) as recipient_label,
  m.customer ->> 'customerName' as customer_name,
  m.customer ->> 'customerEmail' as customer_email,
  m.status,
  m.currency,
  m.pricing_input_amount as input_amount,
  m.pricing_provider_cost as provider_cost,
  coalesce(m.pricing_customer_price, m.quoted_amount) as customer_price,
  m.pricing_margin as net_margin,
  m.pricing_margin_percent as net_margin_percent,
  case when m.pricing_decision ? 'grossMargin' then (m.pricing_decision ->> 'grossMargin')::numeric else null end as gross_margin,
  case when m.pricing_decision ? 'grossMarginPercent' then (m.pricing_decision ->> 'grossMarginPercent')::numeric else null end as gross_margin_percent,
  case when m.pricing_decision ? 'operatingCost' then (m.pricing_decision ->> 'operatingCost')::numeric else null end as operating_cost,
  case when m.pricing_decision ? 'netMarginAfterFees' then (m.pricing_decision ->> 'netMarginAfterFees')::numeric else null end as net_margin_after_fees,
  case when m.pricing_decision ? 'provider' then m.pricing_decision ->> 'provider' else null end as provider,
  m.pricing_strategy,
  m.pricing_decision,
  m.failure_reason,
  case when m.status = 'completed' then m.updated_at else null end as realized_at,
  m.created_at,
  m.updated_at,
  (m.status = 'completed') as realized
from public.manual_billing_orders m;

revoke all on table public.profitability_reporting from anon, authenticated;
grant select on table public.profitability_reporting to service_role;

comment on view public.profitability_reporting is 'Unified profitability analytics surface for JIT and manual billing flows.';