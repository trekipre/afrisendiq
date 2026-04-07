# Afrisendiq Customer Onboarding and Trust Design

Last updated: March 27, 2026

## Goal

Design onboarding that feels premium and low-friction for customers while still supporting AML, KYC, CIP, Patriot Act-style recordkeeping, and partner trust expectations.

This document is intentionally product-facing. It explains how to make compliance feel less punitive without weakening controls.

## Product Positioning

Afrisendiq should not onboard customers like a bank on the first screen.

The better model is:

- discover first
- quote first
- explain trust and safety clearly
- ask for identity only when the customer is about to do something regulated or risky

This is the most customer-friendly model that still supports later partner scrutiny.

## Recommended Account and Verification Ladder

## Step 1: Explore without commitment

Allow the user to:

- browse products
- compare payout outcomes
- see supported countries and services
- estimate fees and delivery expectations

Do not ask for KYC here.

UI guidance:

- headline should focus on speed, trust, and transparency
- legal copy should be present but light
- show “verification only required before sending” messaging

## Step 2: Lightweight account creation

At account creation, collect only:

- email
- mobile number
- full legal name
- country of residence

Authentication recommendation:

- passkey button first
- email magic link second
- SMS OTP backup

UI language recommendation:

- “Create your secure account”
- “We only ask for more verification when regulations or transaction size require it.”

## Step 3: First payment step-up

When the user starts their first real transaction, explain why identity checks appear now.

Recommended explainer card:

> To protect customers, prevent fraud, and meet financial-partner requirements, we verify identity before certain transactions. Most people only need a quick check.

Collect:

- date of birth
- residential address
- any required tax identifier fragment
- identity verification only if needed by rules or risk score

## Step 4: Tiered verification outcomes

Do not show only pass/fail.

Show one of these user-friendly outcomes:

- `Verified for standard transfers`
- `Verified with higher limits`
- `More information needed`
- `Under review`

This makes the experience feel controlled rather than punitive.

## Best-In-Class 2FA Design

## Customer MFA

### Recommended hierarchy

1. Passkeys
2. Email magic link
3. SMS OTP backup

### Step-up events

Require MFA again for:

- new device
- passwordless recovery
- profile changes
- payout destination changes
- unusually large or unusual transactions
- suspicious IP or device behavior

### Trusted-device policy

Let low-risk returning customers skip repeated OTP prompts on a remembered device for a short window, unless a high-risk action occurs.

This improves conversion while still meeting strong-authentication expectations.

## Internal team MFA

Internal users should have stronger controls than customers.

Required:

- mandatory passkey or hardware key
- TOTP fallback only
- role-based privileges
- approval workflow for refunds and overrides
- audit trail for every administrative decision

## Customer-Friendly UX Copy Recommendations

## Before KYC

Use copy like:

- “You can explore pricing before verifying your identity.”
- “Verification is only requested when needed for security or financial regulations.”

## During KYC

Use copy like:

- “This check helps protect your account and keeps our payment partners secure.”
- “Most customers complete this in a few minutes.”

## If more documents are needed

Use copy like:

- “We need one more step to unlock this transaction.”
- “Your information is reviewed securely and only used for verification and compliance.”

Avoid copy like:

- “You failed verification.”
- “High-risk user.”
- “Compliance hold” without explanation

## Onboarding Screens to Build

## Screen 1: Welcome and trust intro

Elements:

- sharp value proposition
- “how it works” trust bullets
- “verification later” note
- primary CTA: Continue with passkey
- secondary CTA: Continue with email

## Screen 2: Contact verification

Elements:

- email verification
- phone OTP
- short note on why phone is needed for account protection and transaction security

## Screen 3: Personal details

Elements:

- legal name
- country
- date of birth if required
- inline explanation for why legal identity matters

## Screen 4: Address and identity

Elements:

- address form
- dynamic prompts based on corridor or limits
- optional document capture only when triggered

## Screen 5: Verification result

Elements:

- status badge
- current sending limits
- what is unlocked now
- next step if more information is needed

## Screen 6: Security center

Elements:

- passkey management
- trusted devices
- phone verification status
- session history
- recovery options

## Compliance Logic That Should Stay Invisible to the Customer

These should run in the background wherever possible:

- sanctions screening
- device fingerprint risk checks
- IP risk and geo mismatch checks
- BIN and payment method risk scoring
- velocity and structuring detection
- account takeover heuristics

Customers should only see an extra step when risk or regulation actually requires it.

## Minimum Data Model for Onboarding

Recommended durable entities:

- `customers`
- `customer_profiles`
- `customer_contact_methods`
- `customer_verification_sessions`
- `customer_verification_decisions`
- `customer_limits`
- `trusted_devices`
- `auth_factors`
- `customer_risk_profiles`
- `compliance_cases`

## Recommended Verification Policy

### Low-risk first purchase

- email verified
- phone verified
- legal name collected
- sanctions and fraud checks run
- no document upload unless triggered

### Medium-risk or limit increase

- DOB and address required
- document-free identity verification preferred
- manual review if automated checks are inconclusive

### High-risk activity

- government ID
- selfie/liveness
- source-of-funds questions if needed
- compliance case opened

## What Strengthens Partner Trust Most

Partners will trust Afrisendiq more if the onboarding system can prove:

1. Who the customer is.
2. What checks were run.
3. When checks were run.
4. Why a transaction was allowed, stepped up, held, or blocked.
5. Which admin, if any, overrode a decision.

That means the real trust signal is not just the UI. It is the evidence trail behind the UI.

## Recommended Immediate Build Order

1. Add customer identity entities and verification states.
2. Add passkey-first auth with email and SMS fallback.
3. Add progressive onboarding UI and policy engine triggers.
4. Add compliance case management and audit logging.
5. Add limits and tier messaging to the customer dashboard.
