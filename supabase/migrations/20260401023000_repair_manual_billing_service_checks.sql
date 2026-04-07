alter table if exists public.manual_billing_orders
  drop constraint if exists manual_billing_orders_service_check;

alter table if exists public.manual_billing_orders
  add constraint manual_billing_orders_service_check
  check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus'));

alter table if exists public.manual_billing_audit_events
  drop constraint if exists manual_billing_audit_events_service_check;

alter table if exists public.manual_billing_audit_events
  add constraint manual_billing_audit_events_service_check
  check (service in ('sodeci', 'cie-postpaid', 'cie-prepaid', 'canal-plus'));
