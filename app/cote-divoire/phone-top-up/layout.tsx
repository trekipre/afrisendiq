import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Recharge Mobile Côte d'Ivoire — MTN, Orange, Moov",
  description:
    "Rechargez un numéro MTN, Orange ou Moov en Côte d'Ivoire depuis l'étranger. Livraison instantanée, meilleurs tarifs diaspora. Send airtime to Ivory Coast instantly.",
  keywords: [
    "recharge MTN côte d'ivoire en ligne",
    "recharge Orange CI diaspora",
    "recharge Moov côte d'ivoire",
    "MTN top-up ivory coast online",
    "send airtime ivory coast",
    "crédit téléphone côte d'ivoire",
  ],
  openGraph: {
    title: "Recharge Mobile Côte d'Ivoire — MTN, Orange, Moov",
    description:
      "Rechargez un numéro mobile en Côte d'Ivoire depuis l'étranger. Livraison instantanée.",
  },
  alternates: {
    canonical: "/cote-divoire/phone-top-up",
  },
};

export default function PhoneTopUpLayout({ children }: { children: ReactNode }) {
  return children;
}
