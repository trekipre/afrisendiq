"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireSectionHeading } from "@/app/components/CoteDIvoireSectionHeading";
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { resolveLocalizedText, useCoteDIvoireLocale, type LocalizedText } from "@/app/components/CoteDIvoireLocale";

type ManualBillingPageProps = {
  service: "sodeci" | "cie-postpaid" | "cie-prepaid" | "canal-plus";
  eyebrow: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  accountLabel: LocalizedText;
  accountPlaceholder: string;
  recipientLabel: LocalizedText;
  heroBadge: LocalizedText;
  theme: "water" | "electricity" | "tv";
  heroImageSrcs?: readonly string[];
  heroImageAlt?: LocalizedText;
  heroPills?: readonly string[];
  packageOptions?: Array<{ code: string; label: string; amount: number }>;
  accountHint?: LocalizedText;
  workflowSteps?: LocalizedText[];
};

type ManualOrder = {
  id: string;
  service: "sodeci" | "cie-postpaid" | "cie-prepaid" | "canal-plus";
  accountReference: string;
  packageCode?: string;
  packageLabel?: string;
  quotedAmount?: number;
  currency: "XOF";
  status: string;
  adminQuoteNotes?: string;
  adminExecutionNotes?: string;
  failureReason?: string;
  customer: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    recipientName: string;
  };
  pricingSummary?: {
    inputAmount: number;
    providerCost: number;
    customerPrice: number;
    afrisendiqMargin: number;
    afrisendiqMarginPercent: number;
    pricingStrategy: string;
  };
  metadata?: {
    normalizedAccountReference?: string;
    fulfillment?: {
      deliveryMethod: "token" | "receipt" | "confirmation";
      customerPhone?: string;
      whatsappTarget?: string;
      whatsappHref?: string;
      whatsappMessageSid?: string;
      token?: string;
      units?: string;
      receiptReference?: string;
      note?: string;
      deliveredAt?: string;
      lastUpdatedAt?: string;
      lastUpdatedBy?: "admin" | "telegram" | "automation";
    };
    notifications?: {
      whatsapp?: {
        status?: string;
        deliveredAt?: string;
        readAt?: string;
        statusRecordedAt?: string;
      };
      primarySms?: {
        provider?: "twilio" | "orange" | "mtn" | "africasTalking";
        target?: string;
        status?: string;
        sentAt?: string;
        deliveredAt?: string;
        lastUpdatedAt?: string;
        lastFailureReason?: string;
        manualShareRequired?: boolean;
        retryCount?: number;
      };
      orangeFallback?: {
        status?: string;
        sentAt?: string;
      };
      twilioSmsFallback?: {
        status?: string;
        sentAt?: string;
      };
      mtnFallback?: {
        status?: string;
        sentAt?: string;
      };
      africasTalkingFallback?: {
        status?: string;
        sentAt?: string;
      };
    };
    insights?: {
      duplicateRisk: "low" | "medium" | "high";
      priority: "low" | "medium" | "high";
      automationStatus: string;
      suggestedNextAction: string;
      relatedOpenOrders: number;
      relatedCompletedOrders: number;
      recentOrderCount: number;
      knownAccount: boolean;
      resumableOrderId?: string;
      resumedExistingOrder?: boolean;
      lastCompletedOrderId?: string;
      lastKnownBillAmount?: number;
      lastKnownQuotedAmount?: number;
    };
  };
};

const themeGradient = {
  water: "from-[#0F5B8D] via-[#1E81B0] to-[#89CFF0]",
  electricity: "from-[#D97706] via-[#F59E0B] to-[#FCD34D]",
  tv: "from-[#5B1A6E] via-[#8B3BAF] to-[#F97316]"
};

const sharedCopy = {
  backToHub: { fr: "Retour Côte d'Ivoire", en: "Back to Côte d'Ivoire" },
  customerName: { fr: "Votre nom", en: "Your name" },
  customerEmail: { fr: "Votre email", en: "Your email" },
  customerPhone: { fr: "Votre téléphone", en: "Your phone" },
  submitRequest: { fr: "Créer la demande", en: "Create request" },
  continueToPayment: { fr: "Payer maintenant", en: "Pay now" },
  refreshStatus: { fr: "Actualiser", en: "Refresh status" },
  waitingQuote: { fr: "Votre demande est en cours de traitement.", en: "Your request is being processed." },
  quoteReady: { fr: "Votre demande est prête. Vous pouvez passer au paiement.", en: "Your request is ready. You can proceed to payment." },
  paid: { fr: "Paiement reçu. Votre demande est en cours de finalisation.", en: "Payment received. Your request is being finalized." },
  completed: { fr: "Commande terminée.", en: "Order completed." },
  failed: { fr: "La commande a échoué. Contactez le support.", en: "The order failed. Contact support." },
  requestSummary: { fr: "Résumé", en: "Summary" },
  status: { fr: "Statut", en: "Status" },
  amount: { fr: "Montant", en: "Amount" },
  baseAmount: { fr: "Montant facture", en: "Bill amount" },
  margin: { fr: "Marge Afrisendiq", en: "AfriSendIQ margin" },
  strategy: { fr: "Stratégie", en: "Strategy" },
  orderId: { fr: "Commande", en: "Order" },
  packageLabel: { fr: "Formule", en: "Package" },
  requiredField: { fr: "Veuillez remplir tous les champs requis.", en: "Please fill in all required fields." },
  createError: { fr: "Impossible de créer la demande.", en: "Unable to create the request." },
  checkoutError: { fr: "Impossible d'ouvrir le paiement.", en: "Unable to open payment." },
  statusError: { fr: "Impossible de charger la commande.", en: "Unable to load the order." },
  packagePrompt: { fr: "Choisir une formule", en: "Choose a package" },
  accountHintTitle: { fr: "Avant de soumettre", en: "Before you submit" },
  workflowTitle: { fr: "Ce qui se passe ensuite", en: "What happens next" },
  insightsTitle: { fr: "Aperçu intelligent", en: "Operational insight" },
  requestTitle: { fr: "Créer votre demande", en: "Create your request" },
  requestDescription: {
    fr: "Saisissez les informations du payeur et du bénéficiaire pour lancer une demande vérifiée.",
    en: "Enter payer and recipient details to launch a verified request."
  },
  summaryDescription: {
    fr: "Suivez le même dossier du devis jusqu'à la preuve d'exécution.",
    en: "Track the same request from quote through proof of execution."
  },
  resumeExisting: { fr: "Une demande existante a été reprise au lieu d'en créer une nouvelle.", en: "An existing request was resumed instead of creating a duplicate." },
  normalizedReference: { fr: "Référence normalisée", en: "Normalized reference" },
  knownAccount: { fr: "Compte déjà traité", en: "Known account" },
  duplicateRisk: { fr: "Risque de doublon", en: "Duplicate risk" },
  priority: { fr: "Priorité opérateur", en: "Operator priority" },
  suggestedAction: { fr: "Prochaine action recommandée", en: "Suggested next action" },
  relatedOpenOrders: { fr: "Demandes ouvertes liées", en: "Related open requests" },
  previousBillAmount: { fr: "Dernier montant facture", en: "Last known bill amount" },
  previousQuoteAmount: { fr: "Dernier montant client", en: "Last known customer quote" },
  deliveryTitle: { fr: "Livraison manuelle", en: "Manual fulfillment" },
  deliveryMethod: { fr: "Méthode", en: "Method" },
  deliveryToken: { fr: "Token", en: "Token" },
  deliveryUnits: { fr: "Unités", en: "Units" },
  deliveryReference: { fr: "Référence", en: "Reference" },
  deliveryNote: { fr: "Note opérateur", en: "Operator note" },
  deliveryPhone: { fr: "Téléphone WhatsApp", en: "WhatsApp phone" },
  deliveryDeliveredAt: { fr: "Livré le", en: "Delivered at" },
  openWhatsapp: { fr: "Ouvrir WhatsApp", en: "Open WhatsApp" },
  copyCode: { fr: "Copier le code", en: "Copy code" },
  copiedCode: { fr: "Code copié.", en: "Code copied." },
  shareCode: { fr: "Partager le code", en: "Share code" },
  shareWhatsapp: { fr: "Partager via WhatsApp", en: "Share via WhatsApp" },
  shareSms: { fr: "Partager par SMS", en: "Share by SMS" },
  resendSms: { fr: "Relancer le SMS", en: "Resend SMS" },
  resendSmsBusy: { fr: "Relance en cours...", en: "Resending..." },
  resendSmsSuccess: { fr: "SMS relance avec succes.", en: "SMS resent successfully." },
  shareUnavailable: { fr: "Le partage n'est pas disponible sur cet appareil.", en: "Sharing is not available on this device." },
  copyUnavailable: { fr: "Impossible de copier automatiquement le code.", en: "Unable to copy the code automatically." },
  whatsappStatus: { fr: "Statut WhatsApp", en: "WhatsApp status" },
  smsStatus: { fr: "Statut SMS", en: "SMS status" },
  deliveryShareHint: {
    fr: "Vous pouvez partager ce code via l'application de votre choix si le client n'a pas encore recu la notification.",
    en: "You can share this code through any app of your choice if the customer has not received the notification yet."
  }
};

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatCurrency(value: number | undefined, currency: string) {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value.toLocaleString()} ${currency}`;
}

function buildDeliveryShareMessage(order: ManualOrder) {
  const fulfillment = order.metadata?.fulfillment;
  const parts = [
    `AfriSendIQ ${order.service}`,
    fulfillment?.token ? `Token: ${fulfillment.token}` : null,
    fulfillment?.units ? `Units: ${fulfillment.units}` : null,
    fulfillment?.receiptReference ? `Reference: ${fulfillment.receiptReference}` : null,
    fulfillment?.note ? `Note: ${fulfillment.note}` : null
  ].filter(Boolean);

  return parts.join("\n");
}

function buildSmsHref(target: string | undefined, message: string) {
  const normalizedTarget = String(target || "").trim();
  const separator = normalizedTarget.includes("?") ? "&" : "?";
  return `sms:${normalizedTarget}${separator}body=${encodeURIComponent(message)}`;
}

function resolveWhatsAppStatusCopy(order: ManualOrder) {
  const whatsapp = order.metadata?.notifications?.whatsapp;

  if (whatsapp?.readAt) {
    return "Read";
  }

  if (whatsapp?.deliveredAt) {
    return "Delivered";
  }

  if (whatsapp?.status) {
    return formatStatus(whatsapp.status);
  }

  if (order.metadata?.fulfillment?.whatsappMessageSid) {
    return "Sent";
  }

  return "Not sent";
}

function resolveSmsStatusCopy(order: ManualOrder) {
  const primarySms = order.metadata?.notifications?.primarySms;

  if (primarySms?.deliveredAt) {
    return "Delivered";
  }

  if (primarySms?.sentAt) {
    return `Sent${primarySms.provider ? ` via ${primarySms.provider}` : ""}`;
  }

  if (primarySms?.manualShareRequired) {
    return "Manual share recommended";
  }

  if (primarySms?.lastFailureReason) {
    return `Failed: ${primarySms.lastFailureReason}`;
  }

  return "Pending";
}

async function fetchManualOrder(orderId: string) {
  const response = await fetch(`/api/cote-divoire/manual-billing/${orderId}`);
  const payload = await response.json();

  return { response, payload };
}

function ManualBillingPageContent({
  service,
  eyebrow,
  title,
  description,
  accountLabel,
  accountPlaceholder,
  recipientLabel,
  heroBadge,
  theme,
  heroImageSrcs = [],
  heroImageAlt,
  heroPills = [],
  packageOptions = [],
  accountHint,
  workflowSteps = []
}: ManualBillingPageProps) {
  const { locale } = useCoteDIvoireLocale();
  const searchParams = useSearchParams();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [accountReference, setAccountReference] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [packageCode, setPackageCode] = useState(packageOptions[0]?.code || "");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendingSms, setResendingSms] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<ManualOrder | null>(null);
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (!orderId) {
      return;
    }

    void (async () => {
      try {
        const { response, payload } = await fetchManualOrder(orderId);

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || resolveLocalizedText(sharedCopy.statusError, locale));
        }

        setCurrentOrder(payload.order);
        setMessage(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.statusError, locale));
      }
    })();
  }, [locale, orderId]);

  async function loadOrder(nextOrderId: string) {
    try {
      const { response, payload } = await fetchManualOrder(nextOrderId);

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || resolveLocalizedText(sharedCopy.statusError, locale));
      }

      setCurrentOrder(payload.order);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.statusError, locale));
    }
  }

  async function handleCreateOrder() {
    if (!customerName.trim() || !customerEmail.trim() || !accountReference.trim() || !recipientName.trim()) {
      setMessage(resolveLocalizedText(sharedCopy.requiredField, locale));
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const selectedPackage = packageOptions.find((option) => option.code === packageCode);
      const response = await fetch("/api/cote-divoire/manual-billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          service,
          accountReference,
          customerName,
          customerEmail,
          customerPhone,
          recipientName,
          packageCode: selectedPackage?.code,
          packageLabel: selectedPackage?.label
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || resolveLocalizedText(sharedCopy.createError, locale));
      }

      setCurrentOrder(payload.order);
      if (payload.order?.metadata?.insights?.resumedExistingOrder) {
        setMessage(resolveLocalizedText(sharedCopy.resumeExisting, locale));
      }
      window.history.replaceState({}, "", `?orderId=${payload.order.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.createError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckout() {
    if (!currentOrder) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cote-divoire/manual-billing/${currentOrder.id}/checkout`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.checkoutUrl) {
        throw new Error(payload.error || resolveLocalizedText(sharedCopy.checkoutError, locale));
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.checkoutError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyCode() {
    if (!currentOrder?.metadata?.fulfillment) {
      return;
    }

    const shareMessage = buildDeliveryShareMessage(currentOrder);

    try {
      await navigator.clipboard.writeText(shareMessage);
      setMessage(resolveLocalizedText(sharedCopy.copiedCode, locale));
    } catch {
      setMessage(resolveLocalizedText(sharedCopy.copyUnavailable, locale));
    }
  }

  async function handleShareCode() {
    if (!currentOrder?.metadata?.fulfillment) {
      return;
    }

    const shareMessage = buildDeliveryShareMessage(currentOrder);

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setMessage(resolveLocalizedText(sharedCopy.shareUnavailable, locale));
      return;
    }

    try {
      await navigator.share({
        title: `AfriSendIQ ${currentOrder.service}`,
        text: shareMessage
      });
    } catch {
      // Ignore share cancellation.
    }
  }

  async function handleResendSms() {
    if (!currentOrder) {
      return;
    }

    setResendingSms(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/cote-divoire/manual-billing/${currentOrder.id}/resend-sms`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || !payload.success || !payload.order) {
        throw new Error(payload.error || resolveLocalizedText(sharedCopy.statusError, locale));
      }

      setCurrentOrder(payload.order);
      setMessage(resolveLocalizedText(sharedCopy.resendSmsSuccess, locale));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.statusError, locale));
    } finally {
      setResendingSms(false);
    }
  }

  function renderStatusMessage(order: ManualOrder) {
    if (order.status === "quote_requested") {
      return resolveLocalizedText(sharedCopy.waitingQuote, locale);
    }

    if (order.status === "quote_ready" || order.status === "payment_pending") {
      return resolveLocalizedText(sharedCopy.quoteReady, locale);
    }

    if (order.status === "paid" || order.status === "operator_started" || order.status === "operator_confirmed") {
      return resolveLocalizedText(sharedCopy.paid, locale);
    }

    if (order.status === "completed") {
      return resolveLocalizedText(sharedCopy.completed, locale);
    }

    return order.failureReason || resolveLocalizedText(sharedCopy.failed, locale);
  }

  const insights = currentOrder?.metadata?.insights;
  const fulfillment = currentOrder?.metadata?.fulfillment;
  const deliveryShareMessage = currentOrder ? buildDeliveryShareMessage(currentOrder) : "";
  const directWhatsappHref = fulfillment?.whatsappTarget
    ? `https://wa.me/${fulfillment.whatsappTarget.replace(/\D/g, "")}?text=${encodeURIComponent(deliveryShareMessage)}`
    : fulfillment?.whatsappHref;
  const directSmsHref = fulfillment?.customerPhone ? buildSmsHref(fulfillment.customerPhone, deliveryShareMessage) : null;
  const whatsappStatusCopy = currentOrder ? resolveWhatsAppStatusCopy(currentOrder) : null;
  const smsStatusCopy = currentOrder ? resolveSmsStatusCopy(currentOrder) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#091912_42%,#050c09_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <CoteDIvoireLanguageSwitch />
            <Link href="/cote-divoire" className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-white transition hover:bg-white/12">
              {resolveLocalizedText(sharedCopy.backToHub, locale)}
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/82">{resolveLocalizedText(eyebrow, locale)}</div>
            <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">{resolveLocalizedText(title, locale)}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78">{resolveLocalizedText(description, locale)}</p>
          </div>

          <div className="overflow-hidden rounded-[2rem] shadow-[0_24px_80px_rgba(3,12,9,0.16)]">
            <CoteDIvoireHeroPanel
              badge={resolveLocalizedText(heroBadge, locale)}
              gradientClass={themeGradient[theme]}
              imageSrcs={heroImageSrcs}
              imageAlt={resolveLocalizedText(heroImageAlt || title, locale)}
              contextLabel="Soutrali · Côte d'Ivoire"
              pills={heroPills}
            />
          </div>
        </section>

        <section className={`mt-10 grid gap-6 ${currentOrder ? "lg:grid-cols-[0.95fr_1.05fr]" : "lg:grid-cols-1"}`}>
          <div className="space-y-6">
            <div className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
              <CoteDIvoireSectionHeading
                locale={locale}
                eyebrow={{ fr: "Soutrali workflow", en: "Soutrali workflow" }}
                title={sharedCopy.requestTitle}
                description={sharedCopy.requestDescription}
              />

              <label className="block text-sm font-semibold">{resolveLocalizedText(sharedCopy.customerName, locale)}</label>
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3" />

              <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(sharedCopy.customerEmail, locale)}</label>
              <input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />

              <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(sharedCopy.customerPhone, locale)}</label>
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />

              <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(accountLabel, locale)}</label>
              <input value={accountReference} onChange={(event) => setAccountReference(event.target.value)} placeholder={accountPlaceholder} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 uppercase" />

              <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(recipientLabel, locale)}</label>
              <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" />

              {packageOptions.length > 0 ? (
                <>
                  <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(sharedCopy.packageLabel, locale)}</label>
                  <select value={packageCode} onChange={(event) => setPackageCode(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3">
                    <option value="">{resolveLocalizedText(sharedCopy.packagePrompt, locale)}</option>
                    {packageOptions.map((option) => (
                      <option key={option.code} value={option.code}>{option.label} ({option.amount.toLocaleString()} XOF)</option>
                    ))}
                  </select>
                </>
              ) : null}

              {message ? <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</div> : null}

              <button onClick={() => void handleCreateOrder()} disabled={submitting} className="mt-6 w-full rounded-xl bg-[#0F3D2E] px-4 py-3 font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:bg-[#4d6a5f]">
                {resolveLocalizedText(sharedCopy.submitRequest, locale)}
              </button>
            </div>

            {(accountHint || workflowSteps.length > 0) ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {accountHint ? (
                  <section className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur">
                    <CoteDIvoireSectionHeading
                      locale={locale}
                      eyebrow={{ fr: "Soutrali guide", en: "Soutrali guide" }}
                      title={sharedCopy.accountHintTitle}
                    />
                    <p className="mt-4 text-sm leading-7 text-emerald-50/82">{resolveLocalizedText(accountHint, locale)}</p>
                  </section>
                ) : null}
                {workflowSteps.length > 0 ? (
                  <section className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur">
                    <CoteDIvoireSectionHeading
                      locale={locale}
                      eyebrow={{ fr: "Soutrali guide", en: "Soutrali guide" }}
                      title={sharedCopy.workflowTitle}
                    />
                    <div className="mt-4 space-y-3 text-sm text-emerald-50/82">
                      {workflowSteps.map((step, index) => (
                        <div key={`${service}-step-${index}`} className="rounded-2xl bg-black/15 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">{index + 1}</div>
                          <div className="mt-1 leading-7">{resolveLocalizedText(step, locale)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>

          {currentOrder ? (
            <div className="space-y-6">
              <section className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                <CoteDIvoireSectionHeading
                  locale={locale}
                  eyebrow={{ fr: "Soutrali status", en: "Soutrali status" }}
                  title={sharedCopy.requestSummary}
                  description={sharedCopy.summaryDescription}
                />
                <div className="mt-4 space-y-4 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.orderId, locale)}</div>
                    <div className="mt-2 font-semibold">{currentOrder.id}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.status, locale)}</div>
                    <div className="mt-2 font-semibold capitalize">{formatStatus(currentOrder.status)}</div>
                    <p className="mt-2 text-slate-600">{renderStatusMessage(currentOrder)}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.amount, locale)}</div>
                      <div className="mt-2 font-semibold">{formatCurrency(currentOrder.quotedAmount, currentOrder.currency)}</div>
                    </div>
                    {currentOrder.pricingSummary ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.baseAmount, locale)}</div>
                        <div className="mt-2 font-semibold">{formatCurrency(currentOrder.pricingSummary.inputAmount, currentOrder.currency)}</div>
                      </div>
                    ) : null}
                    {currentOrder.packageLabel ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.packageLabel, locale)}</div>
                        <div className="mt-2 font-semibold">{currentOrder.packageLabel}</div>
                      </div>
                    ) : null}
                    {currentOrder.metadata?.normalizedAccountReference ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.normalizedReference, locale)}</div>
                        <div className="mt-2 font-semibold">{currentOrder.metadata.normalizedAccountReference}</div>
                      </div>
                    ) : null}
                  </div>
                  {currentOrder.pricingSummary ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.margin, locale)}</div>
                        <div className="mt-2 font-semibold">{formatCurrency(currentOrder.pricingSummary.afrisendiqMargin, currentOrder.currency)}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{resolveLocalizedText(sharedCopy.strategy, locale)}</div>
                        <div className="mt-2 font-semibold capitalize">{formatStatus(currentOrder.pricingSummary.pricingStrategy)}</div>
                      </div>
                    </div>
                  ) : null}
                  {fulfillment ? (
                    <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-950">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryTitle, locale)}</div>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryMethod, locale)}</div>
                          <div className="mt-1 font-semibold capitalize">{fulfillment.deliveryMethod}</div>
                        </div>
                        {fulfillment.customerPhone ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryPhone, locale)}</div>
                            <div className="mt-1 font-semibold">{fulfillment.customerPhone}</div>
                          </div>
                        ) : null}
                        {fulfillment.token ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryToken, locale)}</div>
                            <div className="mt-1 font-semibold">{fulfillment.token}</div>
                          </div>
                        ) : null}
                        {fulfillment.units ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryUnits, locale)}</div>
                            <div className="mt-1 font-semibold">{fulfillment.units}</div>
                          </div>
                        ) : null}
                        {fulfillment.receiptReference ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryReference, locale)}</div>
                            <div className="mt-1 font-semibold">{fulfillment.receiptReference}</div>
                          </div>
                        ) : null}
                        {fulfillment.deliveredAt ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.deliveryDeliveredAt, locale)}</div>
                            <div className="mt-1 font-semibold">{new Date(fulfillment.deliveredAt).toLocaleString()}</div>
                          </div>
                        ) : null}
                        {whatsappStatusCopy ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.whatsappStatus, locale)}</div>
                            <div className="mt-1 font-semibold">{whatsappStatusCopy}</div>
                          </div>
                        ) : null}
                        {smsStatusCopy ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-800">{resolveLocalizedText(sharedCopy.smsStatus, locale)}</div>
                            <div className="mt-1 font-semibold">{smsStatusCopy}</div>
                          </div>
                        ) : null}
                      </div>
                      {fulfillment.note ? <div className="mt-3">{resolveLocalizedText(sharedCopy.deliveryNote, locale)}: {fulfillment.note}</div> : null}
                      <p className="mt-3 text-xs leading-6 text-emerald-900/80">{resolveLocalizedText(sharedCopy.deliveryShareHint, locale)}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCopyCode()}
                          className="rounded-full bg-[#0E2E23] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#145440]"
                        >
                          {resolveLocalizedText(sharedCopy.copyCode, locale)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleShareCode()}
                          className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                        >
                          {resolveLocalizedText(sharedCopy.shareCode, locale)}
                        </button>
                        {directWhatsappHref ? (
                          <a href={directWhatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                            {resolveLocalizedText(sharedCopy.shareWhatsapp, locale)}
                          </a>
                        ) : null}
                        {directSmsHref ? (
                          <a href={directSmsHref} className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100">
                            {resolveLocalizedText(sharedCopy.shareSms, locale)}
                          </a>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleResendSms()}
                          disabled={resendingSms}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resendingSms
                            ? resolveLocalizedText(sharedCopy.resendSmsBusy, locale)
                            : resolveLocalizedText(sharedCopy.resendSms, locale)}
                        </button>
                      </div>
                      {fulfillment.whatsappHref ? (
                        <a href={fulfillment.whatsappHref} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                          {resolveLocalizedText(sharedCopy.openWhatsapp, locale)}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {currentOrder.adminQuoteNotes ? <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">{currentOrder.adminQuoteNotes}</div> : null}
                  {currentOrder.failureReason ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-900">{currentOrder.failureReason}</div> : null}
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => void loadOrder(currentOrder.id)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                      {resolveLocalizedText(sharedCopy.refreshStatus, locale)}
                    </button>
                    {(currentOrder.status === "quote_ready" || currentOrder.status === "payment_pending") ? (
                      <button onClick={() => void handleCheckout()} disabled={submitting} className="rounded-full bg-[#0F3D2E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:bg-[#4d6a5f]">
                        {resolveLocalizedText(sharedCopy.continueToPayment, locale)}
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              {insights ? (
                <section className="rounded-[1.75rem] border border-white/12 bg-white/10 p-6 backdrop-blur">
                  <CoteDIvoireSectionHeading
                    locale={locale}
                    eyebrow={{ fr: "Soutrali insight", en: "Soutrali insight" }}
                    title={sharedCopy.insightsTitle}
                  />
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.priority, locale)}</div>
                      <div className="mt-2 font-semibold capitalize text-white">{formatStatus(insights.priority)}</div>
                    </div>
                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.duplicateRisk, locale)}</div>
                      <div className="mt-2 font-semibold capitalize text-white">{formatStatus(insights.duplicateRisk)}</div>
                    </div>
                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84 md:col-span-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.suggestedAction, locale)}</div>
                      <div className="mt-2 leading-7 text-white">{insights.suggestedNextAction}</div>
                    </div>
                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.relatedOpenOrders, locale)}</div>
                      <div className="mt-2 font-semibold text-white">{insights.relatedOpenOrders}</div>
                    </div>
                    <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.knownAccount, locale)}</div>
                      <div className="mt-2 font-semibold text-white">{insights.knownAccount ? "Yes" : "No"}</div>
                    </div>
                    {typeof insights.lastKnownBillAmount === "number" ? (
                      <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                        <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.previousBillAmount, locale)}</div>
                        <div className="mt-2 font-semibold text-white">{formatCurrency(insights.lastKnownBillAmount, currentOrder.currency)}</div>
                      </div>
                    ) : null}
                    {typeof insights.lastKnownQuotedAmount === "number" ? (
                      <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-emerald-50/84">
                        <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">{resolveLocalizedText(sharedCopy.previousQuoteAmount, locale)}</div>
                        <div className="mt-2 font-semibold text-white">{formatCurrency(insights.lastKnownQuotedAmount, currentOrder.currency)}</div>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function ManualBillingPage(props: ManualBillingPageProps) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[radial-gradient(circle_at_top,#173d32_0%,#091912_42%,#050c09_100%)]" />}>
      <ManualBillingPageContent {...props} />
    </Suspense>
  );
}