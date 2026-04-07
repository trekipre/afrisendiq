# AfriSendIQ

AfriSendIQ is a Next.js application for comparing diaspora transfer providers and powering related airtime flows.

## Local Development

Install dependencies:

```bash
npm install
```

Start the app locally:

```bash
npm run dev
```

The app runs at `http://127.0.0.1:3000` by default.

Internal stuck paid-order alerts now use a server-side admin setting instead of a client env var. The active threshold is stored in `public.internal_settings` under the `manual_billing_alerts` key and can be updated from the internal manual billing or profitability screens.

Internal pages and internal APIs can be protected with HTTP basic auth in production by setting `INTERNAL_DASHBOARD_USERNAME` and `INTERNAL_DASHBOARD_PASSWORD`. The matcher covers `/internal/*` and `/api/internal/*`.

Manual billing WhatsApp-to-Orange fallback requires these deployment env vars:

```bash
ORANGE_SMS_CLIENT_ID=
ORANGE_SMS_CLIENT_SECRET=
ORANGE_SMS_SENDER_ADDRESS=tel:+2250000
ORANGE_SMS_SENDER_NAME=
```

MTN SMS V2 backup fallback requires these deployment env vars:

```bash
MTN_SMS_CONSUMER_KEY=
MTN_SMS_CONSUMER_SECRET=
MTN_SMS_SENDER_ADDRESS=
MTN_SMS_NOTIFY_URL=
MTN_SMS_TARGET_SYSTEM=MADAPI
```

TPECloud SMS fallback requires these deployment env vars:

```bash
TPE_CLOUD_SMS_API_KEY=
TPE_CLOUD_SMS_API_TOKEN=
TPE_CLOUD_SMS_FROM=
TPE_CLOUD_SMS_SENDER_ID=LTECH
TPE_CLOUD_SMS_BASE_URL=https://panel.smsing.app/smsAPI
TPE_CLOUD_SMS_ROUTE_ID=0
TPE_CLOUD_SMS_ROTATE=false
```

The SMSing panel currently shows `LTECH` as `APPROVED` and `SOUTRALI` as `PENDING` on the sender management page. For technical validation, use `LTECH`. Do not switch production traffic to `SOUTRALI` until SMSing marks it approved for the operators you need.

The SMSing panel API page documents `https://panel.smsing.app/smsAPI` and requires both `apikey` and `apitoken`, with the approved sender passed in the `from` field and message text passed in `text`. The repo helper now supports this panel API when `TPE_CLOUD_SMS_API_TOKEN` is configured.

`TPE_CLOUD_SMS_FROM` remains available only for the legacy `https://smsing.cloud/api/v2/SendSMS` integration path. If your account is confirmed to use the panel API, the sender ID should be supplied through `TPE_CLOUD_SMS_SENDER_ID` and `TPE_CLOUD_SMS_FROM` is not required for live sends.

Twilio WhatsApp status callbacks require `NEXT_PUBLIC_BASE_URL` to be a public HTTPS URL so Twilio can call `/api/twilio/status`. Orange delivery receipts should be pointed to `/api/orange/delivery-receipt` after Orange whitelists that HTTPS endpoint. MTN SMS V2 delivery receipts are configured through the SMS V2 subscription API and should point to `/api/mtn/delivery-receipt`. Africa's Talking delivery reports are configured in the Africa's Talking dashboard and should point to `/api/africastalking/delivery-report`. With the production base URL in this repo, that is `https://www.afrisendiq.com/api/africastalking/delivery-report`.

The repo now includes a dedicated internal OTP SMS sender at `/api/internal/sms/otp`. It uses the Africa's Talking sender configuration, applies a branded AfriSendIQ OTP template, and is intended to stay behind the existing internal API protection.

MTN exposes the Soutrali SMS V2 consumer key and consumer secret on `My apps` when you expand the `Soutrali` row. They are not shown on the app edit form.

## Validation

Run lint:

```bash
npm run lint
```

Run the Vitest suite:

```bash
npm run test
```

Run focused Vitest files reliably on Windows:

```bash
npm run test:files -- tests/internalSettings.test.ts tests/smsFallback.test.ts
```

Create a production build:

```bash
npm exec -- next build
```

## What Changed

- Added a reusable branded AfriSendIQ logo component backed by optimized local PNG variants.
- Added a testable airtime purchase service layer with explicit order state transitions.
- Added execution telemetry and provider execution fallback seams under `app/lib`.
- Added Vitest coverage for FX behavior and airtime purchase behavior.

## Key Files

- `app/lib/airtimePurchase.ts`: request processing logic for airtime purchases
- `app/lib/providerExecution.ts`: provider routing and fallback execution
- `app/lib/orderState.ts`: explicit in-memory order state transitions
- `app/lib/executionTelemetry.ts`: execution event recording
- `tests/fx.test.ts`: FX helper tests
- `tests/airtimePurchase.test.ts`: airtime purchase tests
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
