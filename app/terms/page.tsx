import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "../components/LegalPageShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afrisendiq.com"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the Afrisendiq Terms of Service for platform use, payments, transaction handling, refunds, and compliance.",
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
}

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Afrisendiq Terms of Service"
      subtitle="These Terms govern access to the Afrisendiq platform, including digital top-ups, bill payments, gift cards, and merchant-supported transactions made available through third-party providers across supported African markets."
      lastUpdated="March 27, 2026"
      summaryTitle="Before You Use Afrisendiq"
      summaryItems={[
        {
          title: "We are a technology platform",
          description:
            "Afrisendiq helps users access digital services, but it is not a bank, deposit account, or remittance institution.",
        },
        {
          title: "Payments run through partners",
          description:
            "Licensed third-party processors and providers handle payment authorization, settlement, and service delivery.",
        },
        {
          title: "Confirmed transactions are usually final",
          description:
            "Refunds and reversals are limited to duplicate charges, technical failures, fraud review outcomes, or legal requirements.",
        },
        {
          title: "Compliance controls apply",
          description:
            "Afrisendiq may delay, reject, or suspend transactions to satisfy fraud screening, sanctions checks, or partner rules.",
        },
      ]}
      quickFacts={[
        {
          label: "Customer Support",
          value: "support@afrisendiq.com",
        },
        {
          label: "Short Version",
          value: "Prefer a simpler read first? See the plain-language summary of these Terms.",
        },
        {
          label: "Coverage",
          value: "Airtime, data, bill pay, gift cards, and merchant-supported digital service transactions.",
        },
      ]}
    >
      <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
        <div className="font-semibold">Need the consumer-friendly version?</div>
        <p className="mt-2 leading-6 text-emerald-900">
          Start with the <Link href="/terms/summary" className="font-semibold underline underline-offset-4">plain-language summary</Link>. If there is any conflict between that summary and this page, this full Terms page controls.
        </p>
      </div>

      <LegalSection id="acceptance" title="1. Acceptance of These Terms">
        <p>
          By accessing or using Afrisendiq, you agree to be bound by these Terms of Service and any additional policies referenced on the platform. If you do not agree, you must not use the service.
        </p>
      </LegalSection>

      <LegalSection id="about" title="2. About Afrisendiq">
        <p>
          Afrisendiq is a technology platform that enables users to access selected digital services across supported African markets. Services may include airtime and data top-ups, bill payments, gift cards, and merchant-supported transactions.
        </p>
        <p>
          Afrisendiq does not represent that every service is available in every country or corridor. Product availability may change based on partner coverage, compliance requirements, technical constraints, and operational risk controls.
        </p>
      </LegalSection>

      <LegalSection id="service-nature" title="3. Nature of the Service">
        <p>
          Afrisendiq acts solely as an intermediary technology provider. Unless expressly stated otherwise in writing, Afrisendiq is not a bank, deposit-taking institution, payment institution, money transfer company, remittance company, or licensed financial institution.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Afrisendiq does not accept customer deposits.</li>
          <li>Afrisendiq does not hold or safeguard funds on behalf of users as a custodial service.</li>
          <li>Afrisendiq does not guarantee the availability of any provider, route, merchant, or digital product.</li>
        </ul>
      </LegalSection>

      <LegalSection id="eligibility" title="4. Eligibility and User Commitments">
        <p>By using Afrisendiq, you represent and warrant that:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>You are at least 18 years old or the age of majority in your jurisdiction.</li>
          <li>You have legal authority to enter into these Terms.</li>
          <li>The information you provide is true, complete, and current.</li>
          <li>You are using only payment instruments that you are authorized to use.</li>
          <li>Your use of Afrisendiq complies with applicable law, sanctions restrictions, and regulatory requirements.</li>
        </ul>
      </LegalSection>

      <LegalSection id="payments" title="5. Payments and Third-Party Processing">
        <p>
          Payments initiated on Afrisendiq are processed through licensed or authorized third-party payment providers where applicable. Afrisendiq may route transactions through third-party merchants, aggregators, telecom operators, utility providers, and regulated financial partners to complete a service request.
        </p>
        <p>
          By submitting a transaction, you authorize Afrisendiq and its service partners to process your instructions, perform risk screening, and attempt fulfillment through available providers.
        </p>
      </LegalSection>

      <LegalSection id="pricing" title="6. Pricing, Quotes, and Availability">
        <p>
          Prices, fees, exchange-rate displays, service availability, and expected delivery outcomes shown on the platform may change until a transaction is confirmed. Afrisendiq may update pricing or route a transaction through a different provider when necessary for availability, performance, or compliance.
        </p>
        <p>
          Any quote or estimate displayed before confirmation is informational and does not guarantee final fulfillment until the transaction is accepted and processed.
        </p>
      </LegalSection>

      <LegalSection id="execution" title="7. Transaction Execution and Finality">
        <p>
          A transaction is considered submitted once you confirm it through the platform. Completion depends on payment authorization, fraud and compliance review, provider availability, and successful downstream fulfillment.
        </p>
        <p>
          Once a transaction has been processed and confirmed, it is generally final and non-reversible. Afrisendiq may delay, cancel, or reject a transaction where necessary to manage fraud risk, enforce sanctions screening, comply with law, respond to provider failures, or protect platform integrity.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="8. Refunds and Corrections">
        <p>Refunds, reversals, or service credits may be issued only where:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>A transaction fails after payment is captured.</li>
          <li>A duplicate transaction is verified.</li>
          <li>A technical processing error is confirmed.</li>
          <li>Fraud review or legal requirements require corrective action.</li>
        </ul>
        <p>
          Refunds are not guaranteed for losses caused by inaccurate phone numbers, account identifiers, merchant selections, or other user input errors unless recovery is possible.
        </p>
      </LegalSection>

      <LegalSection id="prohibited" title="9. Prohibited Activity">
        <p>You may not use Afrisendiq to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Use stolen, unauthorized, or fraudulently obtained payment methods.</li>
          <li>Launder money or facilitate unlawful financial activity.</li>
          <li>Evade sanctions, screening controls, or transaction limits.</li>
          <li>Probe, interfere with, or circumvent platform security and risk controls.</li>
          <li>Submit false identity, payment, business, or recipient information.</li>
        </ul>
        <p>
          Afrisendiq may suspend or terminate access, cancel transactions, and share relevant information with payment partners or authorities where appropriate.
        </p>
      </LegalSection>

      <LegalSection id="compliance" title="10. Compliance and Verification">
        <p>
          Afrisendiq applies risk-based monitoring, fraud screening, and sanctions controls. We may request identity, payment, recipient, or transaction information to meet legal, regulatory, or partner requirements.
        </p>
        <p>
          Failure to provide requested information may result in delays, refusals, holds, or suspension of access to the platform.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="11. Service Availability and Limitation of Liability">
        <p>
          Afrisendiq provides the platform on an as-is and as-available basis. We do not guarantee uninterrupted access, error-free operation, or successful completion of every transaction.
        </p>
        <p>
          To the fullest extent permitted by law, Afrisendiq is not liable for delays, outages, rejected transactions, provider failures, inaccurate user input, or indirect and consequential losses arising from platform use.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="12. Suspension, Termination, and Updates">
        <p>
          Afrisendiq may suspend, restrict, or terminate your access at any time if we suspect fraud, misuse, policy violations, legal risk, or partner-imposed restrictions.
        </p>
        <p>
          We may update these Terms from time to time. Continued use of the platform after updated Terms are posted constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="13. Governing Law and Contact">
        <p>
          These Terms are governed by the laws of the State of Florida, USA, except where mandatory law requires otherwise. Any dispute relating to these Terms or use of the platform will be resolved in the appropriate courts located in Florida, unless applicable law requires a different venue.
        </p>
        <p>
          Questions about these Terms can be sent to <a href="mailto:support@afrisendiq.com" className="font-semibold text-[#0F3D2E] underline underline-offset-4">support@afrisendiq.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}