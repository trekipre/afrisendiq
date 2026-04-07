alter table public.jit_orders
  add column if not exists pricing_input_amount numeric,
  add column if not exists pricing_provider_cost numeric,
  add column if not exists pricing_customer_price numeric,
  add column if not exists pricing_margin numeric,
  add column if not exists pricing_margin_percent numeric,
  add column if not exists pricing_gross_margin numeric,
  add column if not exists pricing_gross_margin_percent numeric,
  add column if not exists pricing_operating_cost numeric,
  add column if not exists pricing_net_margin_after_fees numeric;

update public.jit_orders
set
  pricing_input_amount = coalesce(pricing_input_amount, amount),
  pricing_provider_cost = coalesce(
    pricing_provider_cost,
    provider_cost,
    case when pricing_decision ? 'providerCost' then (pricing_decision ->> 'providerCost')::numeric else null end
  ),
  pricing_customer_price = coalesce(
    pricing_customer_price,
    quoted_price,
    case when pricing_decision ? 'customerPrice' then (pricing_decision ->> 'customerPrice')::numeric else null end
  ),
  pricing_margin = coalesce(
    pricing_margin,
    margin,
    case when pricing_decision ? 'netMarginAfterCosts' then (pricing_decision ->> 'netMarginAfterCosts')::numeric else null end,
    case when pricing_decision ? 'grossMargin' then (pricing_decision ->> 'grossMargin')::numeric else null end
  ),
  pricing_margin_percent = coalesce(
    pricing_margin_percent,
    case when pricing_decision ? 'netMarginAfterCostsPercent' then (pricing_decision ->> 'netMarginAfterCostsPercent')::numeric else null end,
    case
      when coalesce(pricing_customer_price, quoted_price) is not null
        and coalesce(pricing_customer_price, quoted_price) <> 0
        and coalesce(pricing_margin, margin) is not null
      then (coalesce(pricing_margin, margin) / coalesce(pricing_customer_price, quoted_price)) * 100
      else null
    end
  ),
  pricing_gross_margin = coalesce(
    pricing_gross_margin,
    case when pricing_decision ? 'grossMargin' then (pricing_decision ->> 'grossMargin')::numeric else null end,
    margin
  ),
  pricing_gross_margin_percent = coalesce(
    pricing_gross_margin_percent,
    case when pricing_decision ? 'grossMarginPercent' then (pricing_decision ->> 'grossMarginPercent')::numeric else null end,
    case
      when coalesce(pricing_customer_price, quoted_price) is not null
        and coalesce(pricing_customer_price, quoted_price) <> 0
        and coalesce(pricing_gross_margin, margin) is not null
      then (coalesce(pricing_gross_margin, margin) / coalesce(pricing_customer_price, quoted_price)) * 100
      else null
    end
  ),
  pricing_operating_cost = coalesce(
    pricing_operating_cost,
    case when pricing_decision ? 'operatingCost' then (pricing_decision ->> 'operatingCost')::numeric else null end
  ),
  pricing_net_margin_after_fees = coalesce(
    pricing_net_margin_after_fees,
    case when pricing_decision ? 'netMarginAfterFees' then (pricing_decision ->> 'netMarginAfterFees')::numeric else null end
  );

alter table public.settlements
  add column if not exists pricing_input_amount numeric,
  add column if not exists pricing_provider_cost numeric,
  add column if not exists pricing_customer_price numeric,
  add column if not exists pricing_margin numeric,
  add column if not exists pricing_margin_percent numeric,
  add column if not exists pricing_gross_margin numeric,
  add column if not exists pricing_gross_margin_percent numeric,
  add column if not exists pricing_operating_cost numeric,
  add column if not exists pricing_net_margin_after_fees numeric,
  add column if not exists pricing_decision jsonb;

update public.settlements as s
set
  pricing_input_amount = coalesce(s.pricing_input_amount, j.pricing_input_amount, j.amount),
  pricing_provider_cost = coalesce(s.pricing_provider_cost, s.provider_cost, j.pricing_provider_cost, j.provider_cost),
  pricing_customer_price = coalesce(s.pricing_customer_price, s.customer_paid, j.pricing_customer_price, j.quoted_price),
  pricing_margin = coalesce(s.pricing_margin, s.margin, j.pricing_margin, j.margin),
  pricing_margin_percent = coalesce(s.pricing_margin_percent, j.pricing_margin_percent),
  pricing_gross_margin = coalesce(s.pricing_gross_margin, j.pricing_gross_margin, s.margin),
  pricing_gross_margin_percent = coalesce(s.pricing_gross_margin_percent, j.pricing_gross_margin_percent),
  pricing_operating_cost = coalesce(s.pricing_operating_cost, j.pricing_operating_cost),
  pricing_net_margin_after_fees = coalesce(s.pricing_net_margin_after_fees, j.pricing_net_margin_after_fees),
  pricing_decision = coalesce(s.pricing_decision, j.pricing_decision)
from public.jit_orders as j
where j.id = s.order_id;