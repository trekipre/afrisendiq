import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Catalogue Côte d'Ivoire — Tous les produits disponibles",
  description:
    "Consultez tous les produits disponibles pour la Côte d'Ivoire : recharge mobile, forfait data, CIE FACTURE, SODECI FACTURE, carte cadeau Jumia. Browse all Ivory Coast products.",
  keywords: [
    "catalogue recharge côte d'ivoire",
    "produits côte d'ivoire diaspora",
    "all ivory coast top-up products",
    "Soutrali catalogue",
  ],
  openGraph: {
    title: "Catalogue Côte d'Ivoire — Tous les produits",
    description:
      "Consultez le catalogue complet de produits pour la Côte d'Ivoire, y compris CIE FACTURE et SODECI FACTURE.",
  },
  alternates: {
    canonical: "/cote-divoire/catalog",
  },
};

export default function CatalogLayout({ children }: { children: ReactNode }) {
  return children;
}
