# Afrisendiq Phase 1 Implementation Backlog

Last updated: March 27, 2026

## Goal

Turn the target architecture into a practical Phase 1 build plan with concrete tables, routes, and service seams that can be implemented incrementally without destabilizing the current Stripe and JIT flow.

## Phase 1 Outcome

At the end of Phase 1, Afrisendiq should have:

- stable service contracts for payments, payouts, ledger, and webhooks
- a customer onboarding flow aligned to progressive compliance
- address lookup and address autofill support
- durable schema planning for identity, compliance, and payouts
- room to add Flutterwave later and PawaPay later without rewriting core orchestration

## Priority Order

1. Service contracts and adapters
2. Customer identity and onboarding persistence
3. Compliance and case-management tables
4. Webhook normalization and event persistence
5. Internal ledger journals
6. Payout orchestration

## Concrete Database Tables

### Identity and onboarding

- `customers`
  - `id uuid primary key`
  - `email text unique not null`
  - `phone_e164 text unique`
  - `status text not null`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- `customer_profiles`
  - `customer_id uuid primary key references customers(id)`
  - `legal_first_name text not null`
  - `legal_last_name text not null`
  - `date_of_birth date`
  - `country_of_residence text not null`
  - `citizenship_country text`
  - `tax_id_last4 text`
  - `address_line_1 text`
  - `address_line_2 text`
  - `city text`
  - `region text`
  - `postal_code text`
  - `country_code text`
  - `address_source text`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- `customer_contact_methods`
  - `id uuid primary key`
  - `customer_id uuid not null references customers(id)`
  - `type text not null check (type in ('email','phone'))`
  - `value text not null`
  - `verified boolean not null default false`
  - `verified_at timestamptz`
  - `created_at timestamptz not null default now()`

- `trusted_devices`
  - `id uuid primary key`
  - `customer_id uuid not null references customers(id)`
  - `device_label text`
  - `device_fingerprint text not null`
  - `last_ip inet`
  - `last_seen_at timestamptz not null default now()`
  - `created_at timestamptz not null default now()`

- `auth_factors`
  - `id uuid primary key`
  - `customer_id uuid not null references customers(id)`
  - `factor_type text not null check (factor_type in ('passkey','email_magic_link','sms_otp','totp'))`
  - `status text not null`
  - `last_verified_at timestamptz`
  - `created_at timestamptz not null default now()`

### Compliance and risk

- `customer_limits`
  - `customer_id uuid primary key references customers(id)`
  - `tier text not null`
  - `per_transaction_limit numeric not null`
  - `daily_amount_limit numeric not null`
  - `monthly_amount_limit numeric not null`
  - `updated_at timestamptz not null default now()`

- `customer_risk_profiles`
  - `customer_id uuid primary key references customers(id)`
  - `risk_level text not null`
  - `risk_score numeric not null default 0`
  - `pep_hit boolean not null default false`
  - `sanctions_hit boolean not null default false`
  - `device_risk_score numeric not null default 0`
  - `updated_at timestamptz not null default now()`

- `sanctions_screenings`
  - `id uuid primary key`
  - `customer_id uuid not null references customers(id)`
  - `screening_provider text`
  - `screening_type text not null`
  - `status text not null`
  - `match_score numeric`
  - `raw_result jsonb`
  - `created_at timestamptz not null default now()`

- `compliance_cases`
  - `id uuid primary key`
  - `customer_id uuid references customers(id)`
  - `order_id text`
  - `reason text not null`
  - `status text not null`
  - `priority text not null`
  - `opened_at timestamptz not null default now()`
  - `closed_at timestamptz`

- `case_actions`
  - `id uuid primary key`
  - `case_id uuid not null references compliance_cases(id) on delete cascade`
  - `actor_type text not null`
  - `actor_id text`
  - `action text not null`
  - `notes text`
  - `payload jsonb`
  - `created_at timestamptz not null default now()`

### Payouts and ledger

- `payout_requests`
  - `id uuid primary key`
  - `customer_id uuid references customers(id)`
  - `order_id text`
  - `provider text not null`
  - `amount numeric not null`
  - `currency text not null`
  - `beneficiary_reference text not null`
  - `status text not null`
  - `provider_reference text`
  - `metadata jsonb`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

- `payout_attempts`
  - `id uuid primary key`
  - `payout_request_id uuid not null references payout_requests(id) on delete cascade`
  - `attempt_number integer not null`
  - `status text not null`
  - `provider_payload jsonb`
  - `provider_response jsonb`
  - `created_at timestamptz not null default now()`

- `ledger_accounts`
  - `id uuid primary key`
  - `code text unique not null`
  - `name text not null`
  - `account_type text not null`
  - `currency text not null`
  - `created_at timestamptz not null default now()`

- `ledger_journals`
  - `id uuid primary key`
  - `reference_type text not null`
  - `reference_id text not null`
  - `description text not null`
  - `posted_at timestamptz not null default now()`
  - `metadata jsonb`

- `ledger_entries`
  - `id uuid primary key`
  - `journal_id uuid not null references ledger_journals(id) on delete cascade`
  - `account_id uuid not null references ledger_accounts(id)`
  - `direction text not null check (direction in ('debit','credit'))`
  - `amount numeric not null`
  - `currency text not null`
  - `created_at timestamptz not null default now()`

### Webhooks and domain events

- `inbound_webhook_events`
  - `id uuid primary key`
  - `provider text not null`
  - `provider_event_id text not null`
  - `signature_valid boolean not null`
  - `event_type text not null`
  - `payload jsonb not null`
  - `received_at timestamptz not null default now()`
  - unique `(provider, provider_event_id)`

- `normalized_domain_events`
  - `id uuid primary key`
  - `provider text not null`
  - `source_event_id uuid not null references inbound_webhook_events(id)`
  - `domain_type text not null`
  - `domain_reference text not null`
  - `payload jsonb not null`
  - `created_at timestamptz not null default now()`

- `event_processing_attempts`
  - `id uuid primary key`
  - `domain_event_id uuid not null references normalized_domain_events(id) on delete cascade`
  - `processor text not null`
  - `outcome text not null`
  - `error_message text`
  - `created_at timestamptz not null default now()`

## Concrete API Routes

### Customer onboarding

- `GET /api/onboarding/address-search?q=&countryCode=`
  - returns address suggestions

- `GET /api/onboarding/address-reverse?lat=&lon=`
  - reverse geocodes current location to a draft address

- `POST /api/onboarding/draft`
  - later phase
  - stores onboarding draft state

- `POST /api/onboarding/verify-contact`
  - later phase
  - sends or verifies email and phone challenge

- `POST /api/onboarding/submit-profile`
  - later phase
  - upserts customer and profile data

- `POST /api/onboarding/step-up`
  - later phase
  - initiates enhanced verification

### Payments

- `POST /api/payments/checkout`
  - create provider-agnostic checkout session

- `GET /api/payments/:paymentId`
  - read canonical payment status

- `POST /api/payments/:paymentId/refund`
  - issue refund through canonical payment service

### Payouts

- `POST /api/payouts`
  - create payout request

- `GET /api/payouts/:payoutId`
  - read payout status

- `POST /api/payouts/:payoutId/retry`
  - retry or resubmit payout

### Webhooks

- `POST /api/webhooks/stripe`
- `POST /api/webhooks/flutterwave`
- `POST /api/webhooks/pawapay`

Each route should only verify, persist, normalize, and dispatch. Domain processing should run in a worker or processing layer.

## Phase 1 Service Interfaces

- `PaymentService`
  - `createCheckoutSession()`
  - `getPayment()`
  - `refundPayment()`
  - `verifyWebhook()`

- `PayoutService`
  - `createPayout()`
  - `getPayout()`
  - `cancelPayout()`
  - `verifyWebhook()`

- `WebhookService`
  - `verifyAndNormalize()`
  - `recordReceipt()`
  - `dispatch()`

- `LedgerService`
  - `postJournal()`
  - `reserve()`
  - `releaseReserve()`
  - `getBalances()`

## Recommended Coding Order

1. Add service contracts and placeholder adapters.
2. Build onboarding pages and address routes.
3. Add customer and compliance tables.
4. Build persistence-backed onboarding draft and profile routes.
5. Migrate Stripe webhook logic behind `WebhookService`.
6. Add ledger journal posting for charge, fee, provider cost, and refund events.
