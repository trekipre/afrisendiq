import type { Metadata } from "next"
import { LegalPageShell, LegalSection } from "../components/LegalPageShell"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afrisendiq.com"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read how Afrisendiq collects, uses, stores, and shares personal information when you use the platform.",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy"
      title="Afrisendiq Privacy Policy"
      subtitle="This Privacy Policy explains what personal information Afrisendiq collects, how it is used, when it may be shared, and what rights users have in connection with the platform."
      lastUpdated="March 27, 2026"
      summaryTitle="How We Handle Data"
      summaryItems={[
        {
          title: "We collect what is needed to operate",
          description:
            "That may include contact details, transaction details, device data, and communications with support.",
        },
        {
          title: "We use data for service and safety",
          description:
            "Information is used to process requests, prevent fraud, comply with law, and improve the platform.",
        },
        {
          title: "We share with providers when necessary",
          description:
            "Relevant data may be shared with processors, merchants, telecom operators, and regulated partners that help complete transactions.",
        },
        {
          title: "You can contact us about your data",
          description:
            "Requests about access, correction, or deletion can be sent to support@afrisendiq.com.",
        },
      ]}
      quickFacts={[
        {
          label: "Policy Contact",
          value: "support@afrisendiq.com",
        },
        {
          label: "Main Purpose",
          value: "Operate the platform, prevent fraud, comply with legal obligations, and improve reliability.",
        },
        {
          label: "Applies To",
          value: "Website visitors, users initiating transactions, and people who contact Afrisendiq support.",
        },
      ]}
    >
      <LegalSection id="scope" title="1. Scope of This Policy">
        <p>
          This Privacy Policy applies to personal information collected through the Afrisendiq website, applications, hosted services, customer support channels, and related interactions.
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" title="2. Information We Collect">
        <p>Depending on how you use Afrisendiq, we may collect:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Contact information, such as your name, email address, and support correspondence.</li>
          <li>Transaction information, such as recipient identifiers, service type, amount, corridor, and fulfillment status.</li>
          <li>Payment-related metadata received from processors, such as authorization outcomes and fraud signals.</li>
          <li>Technical and device information, such as IP address, browser type, device identifiers, and usage logs.</li>
          <li>Compliance and verification information when needed to satisfy legal or partner obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" title="3. How We Use Information">
        <p>We may use personal information to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provide, route, and fulfill requested services.</li>
          <li>Authenticate users and protect account or session security.</li>
          <li>Detect, prevent, and investigate fraud, abuse, and policy violations.</li>
          <li>Comply with legal obligations, sanctions screening, and partner requirements.</li>
          <li>Respond to support requests and communicate about transactions.</li>
          <li>Analyze and improve platform reliability, provider performance, and product experience.</li>
        </ul>
      </LegalSection>

      <LegalSection id="sharing" title="4. When We Share Information">
        <p>We may share information with:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Payment processors and regulated financial partners.</li>
          <li>Telecom operators, merchants, utilities, gift card providers, and aggregators involved in fulfillment.</li>
          <li>Cloud infrastructure, analytics, logging, and support service providers acting on our behalf.</li>
          <li>Law enforcement, regulators, courts, or government authorities when required by law or necessary to protect rights and safety.</li>
        </ul>
        <p>
          We do not sell your personal information for cash consideration in the ordinary course of operating Afrisendiq.
        </p>
      </LegalSection>

      <LegalSection id="legal-basis" title="5. Why We Are Allowed to Use Data">
        <p>
          Afrisendiq uses personal information where necessary to provide requested services, operate the platform, protect against fraud and misuse, comply with legal obligations, pursue legitimate business interests, or where you have provided consent when required.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="6. Cookies, Logs, and Technical Data">
        <p>
          Afrisendiq may use cookies, pixels, local storage, server logs, and similar technologies to keep the site functioning, measure usage, protect against abuse, and improve performance.
        </p>
        <p>
          Some browser settings allow you to block or limit cookies, but certain site features may not work correctly if those controls are disabled.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="7. Data Retention">
        <p>
          We retain information for as long as reasonably necessary to provide services, resolve disputes, enforce agreements, detect abuse, comply with legal obligations, and maintain business records. Retention periods may vary based on the type of data and applicable law.
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          Afrisendiq uses reasonable administrative, technical, and organizational safeguards designed to protect personal information. No system is completely secure, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="9. International Processing">
        <p>
          Afrisendiq may process or store information in the United States and other countries where its service providers operate. Those jurisdictions may have data protection laws that differ from the laws of your location.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="10. Your Rights and Choices">
        <p>Subject to applicable law, you may have the right to request access to, correction of, or deletion of your personal information, or to object to or limit certain processing.</p>
        <p>
          To make a request, contact <a href="mailto:support@afrisendiq.com" className="font-semibold text-[#0F3D2E] underline underline-offset-4">support@afrisendiq.com</a>. We may need to verify your identity before responding.
        </p>
      </LegalSection>

      <LegalSection id="children" title="11. Children">
        <p>
          Afrisendiq is not directed to children under 13, and we do not knowingly collect personal information directly from children under 13 through the platform.
        </p>
      </LegalSection>

      <LegalSection id="updates" title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The revised version becomes effective when posted on this page unless otherwise stated.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>
          Questions or requests about this Privacy Policy can be sent to <a href="mailto:support@afrisendiq.com" className="font-semibold text-[#0F3D2E] underline underline-offset-4">support@afrisendiq.com</a>.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}