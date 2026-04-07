import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "CIE FACTURE — Électricité Côte d'Ivoire depuis l'étranger",
  description:
    "Réglez votre CIE FACTURE en Côte d'Ivoire depuis la diaspora. Rechargez aussi CIE COMPTEUR PRÉPAYÉ en ligne. Pay CIE bill from abroad.",
  keywords: [
    "CIE FACTURE depuis l'étranger",
    "CIE FACTURE Côte d'Ivoire",
    "CIE COMPTEUR PRÉPAYÉ",
    "pay CIE bill from abroad",
    "CIE electricity ivory coast",
    "électricité côte d'ivoire diaspora",
  ],
  openGraph: {
    title: "CIE FACTURE — Électricité Côte d'Ivoire",
    description:
      "Réglez votre CIE FACTURE depuis l'étranger. Rechargez aussi CIE COMPTEUR PRÉPAYÉ en ligne.",
  },
  alternates: {
    canonical: "/cote-divoire/cie-prepaid",
  },
};

export default function ElectricityLayout({ children }: { children: ReactNode }) {
  return children;
}
