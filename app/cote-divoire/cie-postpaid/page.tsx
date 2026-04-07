import { ManualBillingPage } from "@/app/components/ManualBillingPage";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";

export default function CiePostpaidPage() {
  return (
    <ManualBillingPage
      service="cie-postpaid"
      eyebrow={{ fr: "CIE FACTURE", en: "CIE Bill" }}
      title={{ fr: "PAIEMENT CIE FACTURE", en: "CIE bill payment" }}
      description={{ fr: "Réglez une facture CIE en Côte d'Ivoire depuis l'étranger.", en: "Pay a CIE bill in Côte d'Ivoire from abroad." }}
      accountLabel={{ fr: "Référence client CIE FACTURE", en: "CIE bill customer reference" }}
      accountPlaceholder="123456789"
      recipientLabel={{ fr: "Nom du titulaire", en: "Account holder name" }}
      heroBadge={{ fr: "Électricité · Facture", en: "Electricity · Bill" }}
      theme="electricity"
      heroImageSrcs={coteDivoireVisualAssets.ciePostpaid}
      heroImageAlt={{ fr: "Carte CIE FACTURE", en: "CIE bill card" }}
      accountHint={{
        fr: "Utilisez la référence exacte de la facture CIE. Évitez les espaces en trop ou les captures approximatives; Afrisendiq normalise la référence et essaie désormais de reprendre une demande déjà ouverte avant d'en créer une nouvelle.",
        en: "Use the exact CIE bill reference. Avoid extra spaces or approximate screenshots; Afrisendiq now normalizes the reference and attempts to resume an existing open request before creating another one."
      }}
      workflowSteps={[
        {
          fr: "Nous créons ou reprenons une demande sécurisée pour cette référence CIE.",
          en: "We create or resume a secure request for this CIE reference."
        },
        {
          fr: "Un opérateur vérifie le montant réel de la facture avant que vous payiez.",
          en: "An operator verifies the live bill amount before you pay."
        },
        {
          fr: "Une fois le paiement reçu, la facture est réglée et suivie dans le même dossier.",
          en: "Once payment is received, the bill is settled and tracked in the same request."
        }
      ]}
    />
  );
}