do $$
declare
  sensitive_tables text[] := array[
    'jit_orders',
    'settlements',
    'guard_audit',
    'webhook_events',
    'onboarding_drafts',
    'customers',
    'customer_profiles',
    'customer_contact_methods',
    'trusted_devices',
    'auth_factors',
    'customer_limits',
    'customer_risk_profiles',
    'sanctions_screenings',
    'compliance_cases',
    'case_actions',
    'inbound_webhook_events',
    'twilio_inbound_messages',
    'manual_billing_orders',
    'manual_billing_audit_events',
    'soutrali_tracked_orders',
    'internal_settings'
  ];
  service_role_rw_tables text[] := array[
    'onboarding_drafts',
    'customers',
    'customer_profiles',
    'customer_contact_methods',
    'trusted_devices',
    'auth_factors',
    'customer_limits',
    'customer_risk_profiles',
    'sanctions_screenings',
    'compliance_cases',
    'case_actions',
    'inbound_webhook_events',
    'twilio_inbound_messages',
    'internal_settings'
  ];
  service_role_ro_tables text[] := array[
    'jit_orders',
    'settlements',
    'guard_audit',
    'webhook_events',
    'manual_billing_orders',
    'manual_billing_audit_events',
    'soutrali_tracked_orders'
  ];
  table_name text;
begin
  foreach table_name in array sensitive_tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = table_name
    ) then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from anon, authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array service_role_rw_tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = table_name
    ) then
      execute format('grant select, insert, update on public.%I to service_role', table_name);
    end if;
  end loop;

  foreach table_name in array service_role_ro_tables loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname = table_name
    ) then
      execute format('grant select on public.%I to service_role', table_name);
    end if;
  end loop;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = 'transfer_providers'
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

create or replace view public.security_diagnostics
with (security_invoker = true) as
with target_tables as (
  select *
  from (
    values
      ('jit_orders'::text, 'sensitive'::text, 'locked_down'::text),
      ('settlements', 'sensitive', 'locked_down'),
      ('guard_audit', 'sensitive', 'locked_down'),
      ('webhook_events', 'sensitive', 'locked_down'),
      ('onboarding_drafts', 'sensitive', 'locked_down'),
      ('customers', 'sensitive', 'locked_down'),
      ('customer_profiles', 'sensitive', 'locked_down'),
      ('customer_contact_methods', 'sensitive', 'locked_down'),
      ('trusted_devices', 'sensitive', 'locked_down'),
      ('auth_factors', 'sensitive', 'locked_down'),
      ('customer_limits', 'sensitive', 'locked_down'),
      ('customer_risk_profiles', 'sensitive', 'locked_down'),
      ('sanctions_screenings', 'sensitive', 'locked_down'),
      ('compliance_cases', 'sensitive', 'locked_down'),
      ('case_actions', 'sensitive', 'locked_down'),
      ('inbound_webhook_events', 'sensitive', 'locked_down'),
      ('twilio_inbound_messages', 'sensitive', 'locked_down'),
      ('manual_billing_orders', 'sensitive', 'locked_down'),
      ('manual_billing_audit_events', 'sensitive', 'locked_down'),
      ('soutrali_tracked_orders', 'sensitive', 'locked_down'),
      ('internal_settings', 'sensitive', 'locked_down'),
      ('transfer_providers', 'public_read_only', 'public_read_only')
  ) as t(table_name, classification, expected_exposure)
), relations as (
  select
    t.table_name,
    t.classification,
    t.expected_exposure,
    c.oid,
    c.relrowsecurity,
    c.relname is not null as exists_in_schema
  from target_tables t
  left join pg_class c on c.relname = t.table_name and c.relkind = 'r'
  left join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.oid is null or n.nspname = 'public'
), policies as (
  select tablename, count(*)::int as policy_count
  from pg_policies
  where schemaname = 'public'
  group by tablename
)
select
  r.table_name,
  r.classification::text as classification,
  r.exists_in_schema,
  coalesce(r.relrowsecurity, false) as row_security_enabled,
  coalesce(p.policy_count, 0) as policy_count,
  case when r.oid is not null then has_table_privilege('anon', r.oid, 'SELECT') else false end as anon_select,
  case when r.oid is not null then has_table_privilege('anon', r.oid, 'INSERT') else false end as anon_insert,
  case when r.oid is not null then has_table_privilege('anon', r.oid, 'UPDATE') else false end as anon_update,
  case when r.oid is not null then has_table_privilege('anon', r.oid, 'DELETE') else false end as anon_delete,
  case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'SELECT') else false end as authenticated_select,
  case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'INSERT') else false end as authenticated_insert,
  case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'UPDATE') else false end as authenticated_update,
  case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'DELETE') else false end as authenticated_delete,
  case when r.oid is not null then has_table_privilege('service_role', r.oid, 'SELECT') else false end as service_role_select,
  r.expected_exposure::text as expected_exposure,
  case
    when not r.exists_in_schema then 'missing'
    when r.classification = 'sensitive'
      and coalesce(r.relrowsecurity, false)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'SELECT') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'INSERT') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'UPDATE') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'DELETE') else false end)
      and not (case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'SELECT') else false end)
      and not (case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'INSERT') else false end)
      and not (case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'UPDATE') else false end)
      and not (case when r.oid is not null then has_table_privilege('authenticated', r.oid, 'DELETE') else false end)
      then 'ok'
    when r.classification = 'public_read_only'
      and coalesce(r.relrowsecurity, false)
      and (case when r.oid is not null then has_table_privilege('anon', r.oid, 'SELECT') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'INSERT') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'UPDATE') else false end)
      and not (case when r.oid is not null then has_table_privilege('anon', r.oid, 'DELETE') else false end)
      then 'ok'
    else 'review'
  end::text as status
from relations r
left join policies p on p.tablename = r.table_name;

revoke all on public.security_diagnostics from anon, authenticated;
grant select on public.security_diagnostics to service_role;

comment on view public.security_diagnostics is 'Current RLS and grant posture for sensitive public-schema tables and intentionally public read-only tables, including onboarding and compliance data.';