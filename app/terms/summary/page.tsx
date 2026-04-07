import type { Metadata } from "next"
import Link from "next/link"
import { LegalPageShell, LegalSection } from "../../components/LegalPageShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afrisendiq.com"

export const metadata: Metadata = {
  title: "Terms Summary",
  description:
    "Read a plain-language summary of the Afrisendiq Terms of Service before using the platform.",
  alternates: {
    canonical: `${SITE_URL}/terms/summary`,
  },
}

export default function TermsSummaryPage() {
  return (
    <LegalPageShell
      eyebrow="Legal Summary"
      title="Afrisendiq Terms, in Plain English"
      subtitle="This page is a simpler explanation of how Afrisendiq works, what users are responsible for, and when transactions may be delayed, rejected, or refunded. The full Terms page controls if there is any difference."
      lastUpdated="March 27, 2026"
      summaryTitle="The Short Version"
      summaryItems={[
        {
          title: "Afrisendiq connects the pieces",
          description:
            "We help you access digital services, but the money movement and fulfillment often depend on outside providers.",
        },
        {
          title: "Enter details carefully",
          description:
            "If you send to the wrong number or account, recovery may not be possible.",
        },
        {
          title: "Fraud checks can pause orders",
          description:
            "We may hold or reject transactions if something looks risky or a partner requires more review.",
        },
        {
          title: "Most completed transactions stay completed",
          description:
            "Refunds are usually limited to duplicate charges, technical failures, or verified error cases.",
        },
      ]}
      quickFacts={[
        {
          label: "Official Version",
          value: "The full Terms of Service remain the controlling legal document.",
        },
        {
          label: "Best For",
          value: "Users who want a quick explanation before reading the full legal language.",
        },
        {
          label: "Read Next",
          value: "Full Terms and the Afrisendiq Privacy Policy.",
        },
      ]}
    >
      <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-5 text-sm text-sky-950">
        <p className="leading-6">
          This summary is for readability only. The official legal terms are on the <Link href="/terms" className="font-semibold underline underline-offset-4">full Terms page</Link>.
        </p>
      </div>

      <LegalSection id="what-we-do" title="1. What Afrisendiq Actually Does">
        <p>
          Afrisendiq helps you access services like airtime, data, bill payments, gift cards, and other supported digital transactions. We are the platform layer, not the bank account behind your payment.
        </p>
      </LegalSection>

      <LegalSection id="who-handles-money" title="2. Who Handles the Money">
        <p>
          Your payment is usually processed through third-party payment providers or regulated partners. Delivery of the service may also depend on outside merchants, telecom operators, or aggregators.
        </p>
      </LegalSection>

      <LegalSection id="what-you-must-do" title="3. What You Must Do">
        <ul className="list-disc space-y-2 pl-6">
          <li>Use your real information.</li>
          <li>Use a payment method you are authorized to use.</li>
          <li>Double-check the phone number, account number, or recipient details before confirming.</li>
          <li>Do not use the platform for fraud, laundering, or sanctions evasion.</li>
        </ul>
      </LegalSection>

      <LegalSection id="when-orders-change" title="4. When a Transaction May Be Delayed or Rejected">
        <p>
          Afrisendiq may pause or decline a transaction if a payment fails, the provider is unavailable, something looks fraudulent, the transaction violates a policy, or a partner needs extra verification.
        </p>
      </LegalSection>

      <LegalSection id="refund-basics" title="5. Refund Basics">
        <p>
          If a completed charge fails to deliver because of a technical issue or duplicate processing, we may issue a refund or correction. If the error happened because incorrect recipient information was submitted, recovery may be limited or impossible.
        </p>
      </LegalSection>

      <LegalSection id="limits" title="6. Our Limits">
        <p>
          We cannot promise that every provider will always be online, every route will always be available, or every third-party system will work perfectly. We do our best to route and process transactions, but some parts are outside our control.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="7. Where to Go Next">
        <p>
          Read the <Link href="/terms" className="font-semibold text-[#0F3D2E] underline underline-offset-4">full Terms of Service</Link> and the <Link href="/privacy" className="font-semibold text-[#0F3D2E] underline underline-offset-4">Privacy Policy</Link> for the complete legal terms. For support, email <a href="mailto:support@afrisendiq.com" className="font-semibold text-[#0F3D2E] underline underline-offset-4">support@afrisendiq.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}