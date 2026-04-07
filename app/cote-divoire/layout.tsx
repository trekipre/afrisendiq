import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CoteDIvoireLocaleProvider } from "@/app/components/CoteDIvoireLocale";

export const metadata: Metadata = {
  title: "Soutrali — Recharge Côte d'Ivoire depuis l'étranger",
  description:
    "Recharge mobile MTN, Orange, Moov, forfait data, CIE FACTURE, SODECI FACTURE et Soutrali Jumia pour la Côte d'Ivoire. Service diaspora rapide et fiable.",
  keywords: [
    "recharge côte d'ivoire diaspora",
    "recharge mobile côte d'ivoire",
    "send airtime ivory coast",
    "Soutrali",
    "MTN Côte d'Ivoire",
    "Orange CI",
    "Moov CI",
    "CIE FACTURE depuis l'étranger",
    "SODECI FACTURE",
    "Soutrali Jumia",
    "bon d'achat Jumia",
    "code PIN Jumia",
  ],
  openGraph: {
    title: "Soutrali — Recharge Côte d'Ivoire depuis l'étranger",
    description:
      "Recharge mobile, data, CIE FACTURE, SODECI FACTURE et Soutrali Jumia pour la Côte d'Ivoire depuis la diaspora.",
    locale: "fr_FR",
    alternateLocale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Soutrali — Recharge Côte d'Ivoire depuis l'étranger",
    description:
      "Recharge mobile, data, CIE FACTURE, SODECI FACTURE et Soutrali Jumia pour la Côte d'Ivoire depuis la diaspora.",
  },
  alternates: {
    canonical: "/cote-divoire",
  },
};

export default function CoteDIvoireLayout({ children }: { children: ReactNode }) {
  return (
    <CoteDIvoireLocaleProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Comment recharger un numéro en Côte d'Ivoire depuis l'étranger ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Avec Soutrali par AfriSendIQ, sélectionnez le produit (MTN, Orange ou Moov), entrez le numéro du destinataire, choisissez le montant et payez par carte. La recharge est livrée instantanément.",
                },
              },
              {
                "@type": "Question",
                name: "How do I send airtime to Côte d'Ivoire from abroad?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "With Soutrali by AfriSendIQ, select the product (MTN, Orange, or Moov), enter the recipient's number, choose the amount, and pay by card. The top-up is delivered instantly.",
                },
              },
              {
                "@type": "Question",
                name: "Peut-on payer CIE FACTURE depuis l'étranger ?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Oui. Soutrali vous permet de régler CIE FACTURE ou de recharger CIE COMPTEUR PRÉPAYÉ en Côte d'Ivoire directement depuis l'étranger avec votre carte bancaire.",
                },
              },
              {
                "@type": "Question",
                name: "Can I buy Jumia gift cards for someone in Côte d'Ivoire?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. With Soutrali Jumia, you can buy a Jumia voucher for someone in Côte d'Ivoire, receive a PIN code, and share it with your recipient for purchases on https://www.jumia.ci.",
                },
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Soutrali",
            provider: { "@type": "Organization", name: "AfriSendIQ" },
            description:
              "Recharge mobile, forfait data, CIE FACTURE, SODECI FACTURE et Soutrali Jumia pour la Côte d'Ivoire depuis la diaspora.",
            areaServed: { "@type": "Country", name: "Côte d'Ivoire" },
            serviceType: [
              "Mobile Top-Up",
              "Data Bundle",
              "CIE Bill Payment",
              "SODECI Bill Payment",
              "Soutrali Jumia Voucher",
            ],
          }),
        }}
      />
      {children}
    </CoteDIvoireLocaleProvider>
  );
}