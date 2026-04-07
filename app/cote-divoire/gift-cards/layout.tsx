import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Soutrali Jumia Côte d'Ivoire — Bon d'achat Jumia",
  description:
    "Envoyez un bon d'achat Jumia à vos proches en Côte d'Ivoire. Recevez un code PIN à partager, utilisable sur https://www.jumia.ci.",
  keywords: [
    "Soutrali Jumia côte d'ivoire",
    "Soutrali Jumia Ivory Coast",
    "bon d'achat Jumia diaspora",
    "code PIN Jumia côte d'ivoire",
    "bon d'achat Jumia côte d'ivoire",
  ],
  openGraph: {
    title: "Soutrali Jumia — Côte d'Ivoire",
    description:
      "Envoyez un bon d'achat Jumia avec code PIN à partager pour des achats sur https://www.jumia.ci.",
  },
  alternates: {
    canonical: "/cote-divoire/gift-cards",
  },
};

export default function GiftCardsLayout({ children }: { children: ReactNode }) {
  return children;
}
