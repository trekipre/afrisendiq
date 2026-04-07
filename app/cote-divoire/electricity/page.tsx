import { ManualBillingPage } from "@/app/components/ManualBillingPage";
import { listCiePrepaidAmountOptions } from "@/app/lib/manualBilling";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";

export default function CieElectricityPage() {
  return (
    <ManualBillingPage
      service="cie-prepaid"
      eyebrow={{ fr: "CIE COMPTEUR PRÉPAYÉ", en: "CIE Prepaid" }}
      title={{ fr: "PAIEMENT CIE COMPTEUR PRÉPAYÉ", en: "CIE prepaid payment" }}
      description={{
        fr: "Choisissez un montant, soumettez le numéro du compteur, puis Afrisendiq finalise manuellement la recharge prépayée CIE pour vos proches en Côte d'Ivoire.",
        en: "Choose an amount, submit the meter number, and AfriSendIQ manually completes the CIE prepaid top-up for your loved ones in Côte d'Ivoire."
      }}
      accountLabel={{ fr: "Numéro du compteur prépayé CIE", en: "CIE prepaid meter number" }}
      accountPlaceholder="24204634364"
      recipientLabel={{ fr: "Nom du titulaire", en: "Account holder name" }}
      heroBadge={{ fr: "Électricité · Prépayé", en: "Electricity · Prepaid" }}
      theme="electricity"
      heroImageSrcs={coteDivoireVisualAssets.electricity}
      heroImageAlt={{ fr: "Carte CIE compteur prépayé", en: "CIE prepaid meter card" }}
      packageOptions={listCiePrepaidAmountOptions().map((option) => ({ ...option }))}
      accountHint={{
        fr: "Saisissez le numéro exact du compteur. Afrisendiq prépare ensuite le paiement manuel du montant choisi et suit l'exécution dans la même demande.",
        en: "Enter the exact meter number. AfriSendIQ then prepares the manual payment for the chosen amount and tracks execution in the same request."
      }}
      workflowSteps={[
        {
          fr: "Vous choisissez le montant prépayé CIE à envoyer avant le paiement.",
          en: "You choose the CIE prepaid amount before payment."
        },
        {
          fr: "Après paiement, la demande passe dans la file opérateur Afrisendiq pour exécution manuelle.",
          en: "After payment, the request moves into the AfriSendIQ operator queue for manual execution."
        },
        {
          fr: "Le même dossier conserve le suivi jusqu'à la confirmation finale de la recharge.",
          en: "The same request keeps the status trail through final top-up confirmation."
        }
      ]}
    />
  );
}