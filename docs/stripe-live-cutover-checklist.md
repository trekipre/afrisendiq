# Stripe Live Cutover Checklist

This runbook is the single production sequence for moving Afrisendiq from test-mode Stripe to live-mode Stripe with minimal operational risk.

## Scope

- Production app URL: `https://www.afrisendiq.com`
- Webhook endpoint: `https://www.afrisendiq.com/api/stripe/webhook`
- Readiness endpoint: `https://www.afrisendiq.com/api/internal/cie-readiness`
- Security diagnostics endpoint: `https://www.afrisendiq.com/api/internal/security`

## Preconditions

Complete these before touching Vercel or Stripe:

1. Confirm the current production deployment is healthy.
2. Confirm Supabase is reachable and security diagnostics report `ok` for sensitive tables.
3. Confirm no stuck `paid` manual billing orders remain unresolved in the internal manual billing queue.
4. Confirm the live Stripe account and live webhook endpoint are ready to use.
5. Keep the current test-mode values available for rollback.

## Production Env Vars

Set these values in Vercel Production.

```env
APP_BASE_URL=https://www.afrisendiq.com
NEXT_PUBLIC_BASE_URL=https://www.afrisendiq.com
NEXT_PUBLIC_SITE_URL=https://www.afrisendiq.com

STRIPE_SECRET_KEY=<live secret key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<live publishable key>

PAYMENTS_LIVE_ENABLED=true

STRIPE_WEBHOOK_SECRET=<live webhook secret>
STRIPE_WEBHOOK_SECRETS=<live webhook secret>,<temporary legacy test webhook secret>
```

Notes:

1. Do not include extra quotes or stray characters when pasting keys into Vercel.
2. Do not keep `STRIPE_CLI_WEBHOOK_SECRET` in production.
3. Keep the legacy test webhook secret only during transition.

## Cutover Sequence

Follow these steps in order.

1. Resolve any currently stuck `paid` manual billing orders.
2. In Vercel Production, update the Stripe env vars to the live values above.
3. Redeploy production.
4. Verify `GET /api/stripe/webhook` returns a healthy JSON response.
5. Verify `GET /api/internal/cie-readiness` reports:
   - Stripe secret key in `live` mode
   - Stripe publishable key in `live` mode
   - Stripe webhook secret configured
   - `PAYMENTS_LIVE_ENABLED` true
6. In Stripe Dashboard for the live account, confirm the webhook endpoint is exactly:
   - `https://www.afrisendiq.com/api/stripe/webhook`
7. In Stripe Dashboard, resend recent failed webhook events.
8. Check the internal manual billing queue and profitability screen for new paid or completed orders.
9. Confirm recent `checkout.session.completed` events are being recorded in `webhook_events` and corresponding orders are moving forward.

## Post-Cutover Validation

Use this validation checklist immediately after the live deployment:

1. Open the internal manual billing queue and confirm no new `paid` orders are aging unexpectedly.
2. Open the profitability screen and confirm new live orders appear in the expected flow.
3. Open the security diagnostics endpoint and confirm no sensitive tables are in `review` state.
4. Confirm Stripe no longer reports webhook delivery failures.
5. Confirm a live payment produces:
   - `checkout.session.completed`
   - `webhook_events.processed = true`
   - the expected order state transition

## Transition Cleanup

After live events are stable and no rollback is needed:

1. Remove the old test webhook secret from `STRIPE_WEBHOOK_SECRETS`.
2. Redeploy production again.
3. Verify webhook deliveries still succeed.

## Rollback

If live Stripe processing fails after cutover:

1. Disable or remove the live webhook endpoint in Stripe Dashboard.
2. Restore the previous test-mode Stripe env vars in Vercel.
3. Set `PAYMENTS_LIVE_ENABLED=false`.
4. Redeploy production.
5. Re-run readiness checks.
6. Review any live payments created during the failed cutover window before attempting a second cutover.

## Incident Review Targets

If anything looks wrong, inspect these first:

1. `webhook_events`
2. `manual_billing_orders`
3. `manual_billing_audit_events`
4. `/api/internal/cie-readiness`
5. `/api/internal/security`
6. Stripe Dashboard webhook delivery logs