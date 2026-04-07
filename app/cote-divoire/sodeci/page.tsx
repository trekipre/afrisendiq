import { ManualBillingPage } from "@/app/components/ManualBillingPage";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";

export default function SodeciPage() {
  return (
    <ManualBillingPage
      service="sodeci"
      eyebrow={{ fr: "SODECI FACTURE", en: "SODECI Bill" }}
      title={{ fr: "PAIEMENT SODECI FACTURE", en: "SODECI bill payment" }}
      description={{ fr: "Réglez une facture SODECI en Côte d'Ivoire depuis l'étranger.", en: "Pay a SODECI bill in Côte d'Ivoire from abroad." }}
      accountLabel={{ fr: "Numéro de compte SODECI FACTURE", en: "SODECI account number" }}
      accountPlaceholder="123456789"
      recipientLabel={{ fr: "Nom de la famille bénéficiaire", en: "Recipient family name" }}
      heroBadge={{ fr: "Eau · Facture", en: "Water · Bill" }}
      theme="water"
      heroImageSrcs={coteDivoireVisualAssets.sodeci}
      heroImageAlt={{ fr: "Carte SODECI FACTURE", en: "SODECI bill card" }}
      accountHint={{
        fr: "Avant de soumettre, saisissez votre numero de reference contrat (9 chiffres).",
        en: "Enter the SODECI account number exactly as it appears on the bill. Afrisendiq now cleans and compares this reference to avoid duplicate requests and speed up repeat bill payments."
      }}
      workflowSteps={[
        {
          fr: "Nous contactons le serveur de la Sodeci pour valider votre compte.",
          en: "We check whether an open SODECI request already exists for this account and family."
        },
        {
          fr: "L'opérateur confirme le montant de la facture avant de vous envoyer au paiement.",
          en: "The operator confirms the live bill amount before sending you to payment."
        },
        {
          fr: "Après paiement, la demande passe dans une file priorisée pour exécution et preuve finale.",
          en: "After payment, the request moves into a prioritized execution queue for final proof and completion."
        }
      ]}
    />
  );
}