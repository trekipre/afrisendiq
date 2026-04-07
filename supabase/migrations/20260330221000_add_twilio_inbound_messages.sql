create table if not exists public.twilio_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  provider_message_sid text not null unique,
  account_sid text,
  messaging_service_sid text,
  channel text not null check (channel in ('sms', 'whatsapp')),
  from_number text not null,
  to_number text not null,
  body text,
  profile_name text,
  num_media integer not null default 0,
  media_urls jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null,
  signature_valid boolean not null,
  received_at timestamptz not null default now()
);

create index if not exists twilio_inbound_messages_received_at_idx
  on public.twilio_inbound_messages (received_at desc);

create index if not exists twilio_inbound_messages_channel_idx
  on public.twilio_inbound_messages (channel, received_at desc);

create index if not exists twilio_inbound_messages_from_number_idx
  on public.twilio_inbound_messages (from_number, received_at desc);

alter table public.twilio_inbound_messages enable row level security;

revoke all on public.twilio_inbound_messages from anon, authenticated;
grant select, insert, update on public.twilio_inbound_messages to service_role;

comment on table public.twilio_inbound_messages is 'Durable inbound SMS and WhatsApp messages received through Twilio webhooks.';

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
      ('inbound_webhook_events', 'sensitive', 'locked_down'),
      ('twilio_inbound_messages', 'sensitive', 'locked_down'),
      ('manual_billing_orders', 'sensitive', 'locked_down'),
      ('manual_billing_audit_events', 'sensitive', 'locked_down'),
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