alter table public.jit_orders
  add column if not exists pricing_payment_method text,
  add column if not exists pricing_user_country_code text,
  add column if not exists ai_location_cluster text,
  add column if not exists ai_profile_source text;

update public.jit_orders
set
  pricing_payment_method = coalesce(pricing_payment_method, pricing_decision -> 'aiOptimization' ->> 'paymentMethod'),
  pricing_user_country_code = coalesce(pricing_user_country_code, pricing_decision -> 'aiOptimization' ->> 'userCountryCode'),
  ai_location_cluster = coalesce(ai_location_cluster, pricing_decision -> 'aiOptimization' ->> 'locationCluster'),
  ai_profile_source = coalesce(ai_profile_source, pricing_decision -> 'aiOptimization' ->> 'locationProfileSource');

alter table public.settlements
  add column if not exists pricing_payment_method text,
  add column if not exists pricing_user_country_code text,
  add column if not exists ai_location_cluster text,
  add column if not exists ai_profile_source text;

update public.settlements as s
set
  pricing_payment_method = coalesce(s.pricing_payment_method, j.pricing_payment_method, s.pricing_decision -> 'aiOptimization' ->> 'paymentMethod'),
  pricing_user_country_code = coalesce(s.pricing_user_country_code, j.pricing_user_country_code, s.pricing_decision -> 'aiOptimization' ->> 'userCountryCode'),
  ai_location_cluster = coalesce(s.ai_location_cluster, j.ai_location_cluster, s.pricing_decision -> 'aiOptimization' ->> 'locationCluster'),
  ai_profile_source = coalesce(s.ai_profile_source, j.ai_profile_source, s.pricing_decision -> 'aiOptimization' ->> 'locationProfileSource')
from public.jit_orders as j
where j.id = s.order_id;

alter table public.manual_billing_orders
  add column if not exists pricing_payment_method text,
  add column if not exists pricing_user_country_code text,
  add column if not exists ai_location_cluster text,
  add column if not exists ai_profile_source text;

update public.manual_billing_orders
set
  pricing_payment_method = coalesce(pricing_payment_method, pricing_decision -> 'aiOptimization' ->> 'paymentMethod', 'manual'),
  pricing_user_country_code = coalesce(pricing_user_country_code, pricing_decision -> 'aiOptimization' ->> 'userCountryCode', country_code),
  ai_location_cluster = coalesce(ai_location_cluster, pricing_decision -> 'aiOptimization' ->> 'locationCluster'),
  ai_profile_source = coalesce(ai_profile_source, pricing_decision -> 'aiOptimization' ->> 'locationProfileSource');

comment on column public.jit_orders.pricing_payment_method is 'Payment rail used when the quote was produced so realized profitability can be sliced by rail.';
comment on column public.jit_orders.pricing_user_country_code is 'Normalized origin country code used by the AI optimizer at quote time.';
comment on column public.jit_orders.ai_location_cluster is 'AI optimizer location cluster captured on the order for observability and analytics.';
comment on column public.jit_orders.ai_profile_source is 'Whether the AI optimizer used a static or learned location profile.';

comment on column public.settlements.pricing_payment_method is 'Payment rail copied from the quoted order into the settlement ledger.';
comment on column public.settlements.pricing_user_country_code is 'Origin country code copied from the quoted order into the settlement ledger.';
comment on column public.settlements.ai_location_cluster is 'AI optimizer location cluster copied into the settlement ledger.';
comment on column public.settlements.ai_profile_source is 'Whether the AI optimizer used a static or learned location profile for the settlement.';

comment on column public.manual_billing_orders.pricing_payment_method is 'Payment rail persisted for manual billing profitability analytics.';
comment on column public.manual_billing_orders.pricing_user_country_code is 'Origin country code persisted for manual billing profitability analytics.';
comment on column public.manual_billing_orders.ai_location_cluster is 'AI optimizer location cluster for manual billing quotes.';
comment on column public.manual_billing_orders.ai_profile_source is 'Whether the AI optimizer used a static or learned location profile for manual billing.';

drop view if exists public.profitability_reporting;

create view public.profitability_reporting
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
    s.pricing_payment_method,
    s.pricing_user_country_code,
    s.ai_location_cluster,
    s.ai_profile_source,
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
  coalesce(ls.pricing_payment_method, j.pricing_payment_method, j.pricing_decision -> 'aiOptimization' ->> 'paymentMethod') as payment_method,
  coalesce(ls.pricing_user_country_code, j.pricing_user_country_code, j.pricing_decision -> 'aiOptimization' ->> 'userCountryCode') as user_country_code,
  coalesce(ls.ai_location_cluster, j.ai_location_cluster, j.pricing_decision -> 'aiOptimization' ->> 'locationCluster') as ai_location_cluster,
  coalesce(ls.ai_profile_source, j.ai_profile_source, j.pricing_decision -> 'aiOptimization' ->> 'locationProfileSource') as ai_profile_source,
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
  coalesce(m.pricing_payment_method, m.pricing_decision -> 'aiOptimization' ->> 'paymentMethod', 'manual') as payment_method,
  coalesce(m.pricing_user_country_code, m.pricing_decision -> 'aiOptimization' ->> 'userCountryCode', m.country_code) as user_country_code,
  coalesce(m.ai_location_cluster, m.pricing_decision -> 'aiOptimization' ->> 'locationCluster') as ai_location_cluster,
  coalesce(m.ai_profile_source, m.pricing_decision -> 'aiOptimization' ->> 'locationProfileSource') as ai_profile_source,
  case when m.pricing_decision ? 'provider' then m.pricing_decision ->> 'provider' else null end as provider,
  m.pricing_strategy,
  m.pricing_decision,
  m.failure_reason,
  case when m.status = 'completed' then m.updated_at else null end as realized_at,
  m.created_at,
  m.updated_at,
  (m.status = 'completed') as realized
from public.manual_billing_orders m;