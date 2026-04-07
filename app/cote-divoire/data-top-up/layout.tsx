import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Forfait Internet Côte d'Ivoire — Data MTN, Orange, Moov",
  description:
    "Achetez un forfait data pour la Côte d'Ivoire depuis l'étranger. MTN, Orange, Moov — rechargez internet instantanément. Buy data bundles for Ivory Coast from abroad.",
  keywords: [
    "forfait internet côte d'ivoire",
    "recharge data MTN CI",
    "forfait data Orange côte d'ivoire",
    "buy data côte d'ivoire",
    "data top-up ivory coast diaspora",
    "internet côte d'ivoire depuis l'étranger",
  ],
  openGraph: {
    title: "Forfait Internet Côte d'Ivoire — Data MTN, Orange, Moov",
    description:
      "Achetez un forfait data pour la Côte d'Ivoire depuis l'étranger. Livraison instantanée.",
  },
  alternates: {
    canonical: "/cote-divoire/data-top-up",
  },
};

export default function DataTopUpLayout({ children }: { children: ReactNode }) {
  return children;
}
