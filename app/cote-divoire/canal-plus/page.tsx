import { ManualBillingPage } from "@/app/components/ManualBillingPage";
import { listCanalPlusPackages } from "@/app/lib/manualBilling";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";

export default function CanalPlusPage() {
  return (
    <ManualBillingPage
      service="canal-plus"
      eyebrow={{ fr: "CANAL+", en: "Canal+" }}
      title={{ fr: "PAIEMENT CANAL+", en: "Canal+ payment" }}
      description={{ fr: "Payez un abonnement Canal+ pour vos proches en Côte d'Ivoire.", en: "Pay for a Canal+ subscription for your loved ones in Côte d'Ivoire." }}
      accountLabel={{ fr: "Numéro d'abonné Canal+", en: "Canal+ subscriber number" }}
      accountPlaceholder="12345678901234"
      recipientLabel={{ fr: "Nom du bénéficiaire", en: "Recipient name" }}
      heroBadge={{ fr: "CANAL+", en: "Canal+" }}
      theme="tv"
      heroImageSrcs={coteDivoireVisualAssets.canalPlus}
      heroImageAlt={{ fr: "Carte Canal+", en: "Canal+ card" }}
      packageOptions={listCanalPlusPackages().map((pkg) => ({ ...pkg }))}
    />
  );
}