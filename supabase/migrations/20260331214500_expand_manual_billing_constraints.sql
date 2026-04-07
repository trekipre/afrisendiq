do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname = 'manual_billing_orders'
    and pg_get_constraintdef(con.oid) ilike '%service in (%';

  if constraint_name is not null then
    execute format('alter table public.manual_billing_orders drop constraint %I', constraint_name);
  end if;

  alter table public.manual_billing_orders
    add constraint manual_billing_orders_service_check
    check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus'));
exception
  when duplicate_object then null;
end $$;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname = 'manual_billing_audit_events'
    and pg_get_constraintdef(con.oid) ilike '%service in (%';

  if constraint_name is not null then
    execute format('alter table public.manual_billing_audit_events drop constraint %I', constraint_name);
  end if;

  alter table public.manual_billing_audit_events
    add constraint manual_billing_audit_events_service_check
    check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus'));
exception
  when duplicate_object then null;
end $$;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public'
    and rel.relname = 'manual_billing_audit_events'
    and pg_get_constraintdef(con.oid) ilike '%channel in (%';

  if constraint_name is not null then
    execute format('alter table public.manual_billing_audit_events drop constraint %I', constraint_name);
  end if;

  alter table public.manual_billing_audit_events
    add constraint manual_billing_audit_events_channel_check
    check (channel in ('stripe_webhook', 'telegram_send', 'telegram_callback', 'whatsapp_send', 'admin', 'automation', 'system'));
exception
  when duplicate_object then null;
end $$;