"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireSectionHeading } from "@/app/components/CoteDIvoireSectionHeading";
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel";
import { CoteDIvoireServiceLogo } from "@/app/components/CoteDIvoireServiceLogo";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { SoutraliCodeReadyCard } from "@/app/components/SoutraliCodeReadyCard";
import { resolveLocalizedText, useCoteDIvoireLocale } from "@/app/components/CoteDIvoireLocale";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";
import {
  SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS,
  SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS,
  type SoutraliTrackedCheckoutResponse,
  type SoutraliTrackedCustomerStatus,
  type SoutraliTrackedOrderCustomerView,
  type SoutraliTrackedOrderLookupResponse,
} from "@/app/lib/soutraliTrackedClient";

type SoutraliProduct = {
  id: string;
  name: string;
  description: string;
  brand?: string;
  amountOptions: number[];
  recipientLabel: string;
  customerReferenceLabel: string;
  serviceLogoPath?: string;
};

type CompletedGiftCardState = {
  reference: string;
  productName: string;
  rechargeCode: string;
  recipientContact: string;
  recipientName: string;
  amount: number;
  completedAt?: string;
};

type PendingGiftCardState = {
  orderId: string;
  customerStatus: SoutraliTrackedCustomerStatus;
  reference?: string | null;
  rechargeCode?: string | null;
  quotedPrice?: number;
  productName: string;
  recipientContact: string;
  recipientName: string;
  amount: number;
  completedAt?: string;
};

const GIFT_CARD_COMPLETION_STORAGE_KEY = "afrisendiq-ci-jumia-completion";
const GIFT_CARD_PENDING_STORAGE_KEY = "afrisendiq-ci-jumia-pending-order";

const giftCardCopy = {
  eyebrow: { fr: "Soutrali Jumia", en: "Soutrali Jumia" },
  backToHub: { fr: "Retour", en: "Back" },
  title: { fr: "Soutrali Jumia", en: "Soutrali Jumia" },
  description: {
    fr: "Envoyez un bon d'achat Jumia à vos proches en Côte d'Ivoire. Vous recevez un code PIN à partager, utilisable ensuite sur https://www.jumia.ci.",
    en: "Send a Jumia voucher to your loved ones in Côte d'Ivoire. You receive a PIN code to share, which they can then use on https://www.jumia.ci."
  },
  orderDescription: {
    fr: "Sélectionnez un bon, ajoutez le contact du bénéficiaire et finalisez l'envoi dans le même parcours.",
    en: "Select a voucher, add the recipient contact, and complete delivery in the same flow."
  },
  howToTitle: { fr: "COMMENT UTILISER", en: "HOW TO USE" },
  howToSteps: {
    fr: [
      "Choisissez un bon d'achat Jumia Soutrali.",
      "Vous recevrez un code PIN.",
      "Partagez-le avec vos bien-aimés en Côte d'Ivoire.",
      "Ils pourront ensuite l'utiliser pour leurs achats sur https://www.jumia.ci."
    ],
    en: [
      "Choose a Soutrali Jumia voucher.",
      "You will receive a PIN code.",
      "Share it with your loved ones in Côte d'Ivoire.",
      "They can then use it for purchases on https://www.jumia.ci."
    ]
  },
  signature: {
    fr: "Soutrali Jumia, distributeur agréé de bonheur.",
    en: "Soutrali Jumia, an approved distributor of joy."
  },
  provider: { fr: "Plateforme", en: "Platform" },
  country: { fr: "Pays", en: "Country" },
  currentAmount: { fr: "Montant", en: "Amount" },
  recipientEmail: { fr: "Email ou téléphone du bénéficiaire", en: "Recipient email or phone" },
  recipientName: { fr: "Nom du bénéficiaire", en: "Recipient name" },
  selectProduct: { fr: "Choisir un montant", en: "Select an amount" },
  chooseProduct: { fr: "Choisissez un produit", en: "Choose a product" },
  amount: { fr: "Montant", en: "Amount" },
  selectedProduct: { fr: "Produit sélectionné", en: "Selected product" },
  enterRecipient: { fr: "Veuillez entrer l'email ou le téléphone du bénéficiaire.", en: "Please enter the recipient email or phone." },
  enterName: { fr: "Veuillez entrer le nom du bénéficiaire.", en: "Please enter the recipient name." },
  selectBeforeContinue: { fr: "Veuillez choisir un produit.", en: "Please select a product." },
  routing: { fr: "Préparation du paiement sécurisé...", en: "Preparing secure payment..." },
  redirectingToPayment: { fr: "Redirection vers Stripe pour finaliser le paiement...", en: "Redirecting to Stripe to complete payment..." },
  paymentCancelled: { fr: "Le paiement a été annulé avant confirmation. Vous pouvez réessayer.", en: "Payment was cancelled before confirmation. You can try again." },
  pendingTitle: { fr: "Carte cadeau en cours de traitement", en: "Gift card being processed" },
  pendingDescription: { fr: "Le paiement est reçu ou en cours de confirmation. AfriSendIQ finalise maintenant la génération du code Jumia.", en: "The payment has been received or is being confirmed. AfriSendIQ is now finalizing the Jumia code generation." },
  pendingReference: { fr: "Référence AfriSendIQ", en: "AfriSendIQ reference" },
  pendingStatus: { fr: "Statut AfriSendIQ : {status}", en: "AfriSendIQ status: {status}" },
  pendingPolling: { fr: "Le suivi se met à jour automatiquement jusqu'à disponibilité du code ou au remboursement.", en: "Tracking refreshes automatically until the code is available or the payment is refunded." },
  paymentReceivedStatus: { fr: "Paiement confirmé", en: "Payment confirmed" },
  processingStatus: { fr: "Code en préparation", en: "Code being prepared" },
  refundedStatus: { fr: "Paiement remboursé", en: "Payment refunded" },
  failedStatus: { fr: "Traitement interrompu", en: "Processing interrupted" },
  refreshStatus: { fr: "Actualiser le statut", en: "Refresh status" },
  clearTrackedTransaction: { fr: "Effacer le suivi", en: "Clear tracked transaction" },
  statusLookupFailed: { fr: "Impossible de récupérer le suivi pour le moment. Réessayez dans quelques instants.", en: "Unable to retrieve tracking right now. Try again shortly." },
  refundedMessage: { fr: "Le paiement a été remboursé automatiquement. Aucun bon définitif n'a été émis côté client.", en: "The payment was refunded automatically. No final voucher was issued on the customer side." },
  failedMessage: { fr: "La carte cadeau n'a pas pu être finalisée. Réessayez ou contactez AfriSendIQ si le statut reste bloqué.", en: "The gift card could not be finalized. Retry or contact AfriSendIQ if the status remains stuck." },
  codeReadyTitle: { fr: "Code prêt à être partagé", en: "Code ready to be shared" },
  codeReadyDescription: { fr: "Le bon Jumia est prêt. Partagez le code avec votre proche ou ouvrez directement Jumia Côte d'Ivoire.", en: "The Jumia voucher is ready. Share the code with your recipient or open Jumia Côte d'Ivoire directly." },
  codeLabel: { fr: "Code Jumia", en: "Jumia code" },
  recipientChannel: { fr: "Canal du bénéficiaire", en: "Recipient channel" },
  orderReference: { fr: "Référence de commande", en: "Order reference" },
  completionNote: { fr: "Le bénéficiaire pourra utiliser ce code lors du paiement sur jumia.ci.", en: "The recipient can apply this code during checkout on jumia.ci." },
  copyCode: { fr: "Copier le code", en: "Copy code" },
  copiedCode: { fr: "Code copié.", en: "Code copied." },
  shareWhatsapp: { fr: "Partager via WhatsApp", en: "Share via WhatsApp" },
  shareEmail: { fr: "Partager par email", en: "Share by email" },
  openJumia: { fr: "Ouvrir Jumia.ci", en: "Open Jumia.ci" },
  sendAnother: { fr: "Envoyer une nouvelle carte", en: "Send another gift card" },
  paymentFailed: { fr: "Échec de l'envoi.", en: "Sending failed." },
  endpointFailed: { fr: "Service temporairement indisponible. Veuillez réessayer.", en: "Service temporarily unavailable. Please try again." },
  submitting: { fr: "Envoi...", en: "Sending..." },
  continue: { fr: "Envoyer la carte cadeau", en: "Send gift card" }
};

function JumiaGiftCardPageContent() {
  const searchParams = useSearchParams();
  const [recipientContact, setRecipientContact] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [products, setProducts] = useState<SoutraliProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [amount, setAmount] = useState(5000);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [completedGiftCard, setCompletedGiftCard] = useState<CompletedGiftCardState | null>(null);
  const [pendingGiftCard, setPendingGiftCard] = useState<PendingGiftCardState | null>(null);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const { locale } = useCoteDIvoireLocale();
  const howToSteps = locale === "fr" ? giftCardCopy.howToSteps.fr : giftCardCopy.howToSteps.en;

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;

  useEffect(() => {
    try {
      const storedCompletion = window.localStorage.getItem(GIFT_CARD_COMPLETION_STORAGE_KEY);
      if (!storedCompletion) {
        return;
      }

      const parsedCompletion = JSON.parse(storedCompletion) as CompletedGiftCardState;
      if (!parsedCompletion?.reference || !parsedCompletion?.rechargeCode) {
        window.localStorage.removeItem(GIFT_CARD_COMPLETION_STORAGE_KEY);
        return;
      }

      setCompletedGiftCard(parsedCompletion);
      setRecipientContact(parsedCompletion.recipientContact || "");
      setRecipientName(parsedCompletion.recipientName || "");
      setAmount(parsedCompletion.amount || 5000);
    } catch {
      window.localStorage.removeItem(GIFT_CARD_COMPLETION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const storedPending = window.localStorage.getItem(GIFT_CARD_PENDING_STORAGE_KEY);
      if (!storedPending) {
        return;
      }

      const parsedPending = JSON.parse(storedPending) as PendingGiftCardState;
      if (!parsedPending?.orderId || !parsedPending?.customerStatus) {
        window.localStorage.removeItem(GIFT_CARD_PENDING_STORAGE_KEY);
        return;
      }

      setPendingGiftCard(parsedPending);
      setRecipientContact(parsedPending.recipientContact || "");
      setRecipientName(parsedPending.recipientName || "");
      setAmount(parsedPending.amount || 5000);
    } catch {
      window.localStorage.removeItem(GIFT_CARD_PENDING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!completedGiftCard) {
      window.localStorage.removeItem(GIFT_CARD_COMPLETION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(GIFT_CARD_COMPLETION_STORAGE_KEY, JSON.stringify(completedGiftCard));
  }, [completedGiftCard]);

  useEffect(() => {
    if (!pendingGiftCard) {
      window.localStorage.removeItem(GIFT_CARD_PENDING_STORAGE_KEY);
      setPollAttemptCount(0);
      return;
    }

    window.localStorage.setItem(GIFT_CARD_PENDING_STORAGE_KEY, JSON.stringify(pendingGiftCard));
  }, [pendingGiftCard]);

  const clearCompletedGiftCard = () => {
    setCompletedGiftCard(null);
    setPendingGiftCard(null);
    setStatusMessage(null);
    setPollAttemptCount(0);
  };

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/soutrali/products?category=gift-card");
        const payload = await response.json();

        if (response.ok && payload.success) {
          setProducts(payload.products || []);
          const first = payload.products?.[0];
          if (first) {
            setSelectedProductId(first.id);
            if (typeof first.amountOptions?.[0] === "number") {
              setAmount(first.amountOptions[0]);
            }
          }
        }
      } catch {
        setProducts([]);
      }
    }

    void loadProducts();
  }, []);

  function formatCustomerStatus(status: SoutraliTrackedCustomerStatus) {
    if (status === "payment_received") {
      return resolveLocalizedText(giftCardCopy.paymentReceivedStatus, locale);
    }

    if (status === "processing") {
      return resolveLocalizedText(giftCardCopy.processingStatus, locale);
    }

    if (status === "refunded") {
      return resolveLocalizedText(giftCardCopy.refundedStatus, locale);
    }

    if (status === "failed") {
      return resolveLocalizedText(giftCardCopy.failedStatus, locale);
    }

    return resolveLocalizedText(giftCardCopy.processingStatus, locale);
  }

  function applyTrackedOrder(order: SoutraliTrackedOrderCustomerView) {
    const nextPending = {
      orderId: order.id,
      customerStatus: order.customerStatus,
      reference: order.reference,
      rechargeCode: order.rechargeCode,
      quotedPrice: order.quotedPrice,
      productName: order.productName,
      recipientContact: order.customerReference,
      recipientName: order.recipientLabel,
      amount: order.amount,
      completedAt: order.rechargeCode ? order.updatedAt : undefined,
    } satisfies PendingGiftCardState;

    setRecipientContact(order.customerReference);
    setRecipientName(order.recipientLabel);
    setAmount(order.amount);
    if (order.productId) {
      setSelectedProductId(order.productId);
    }

    if (order.customerStatus === "code_ready" && order.rechargeCode) {
      setCompletedGiftCard({
        reference: order.reference || order.id,
        productName: order.productName,
        rechargeCode: order.rechargeCode,
        recipientContact: order.customerReference,
        recipientName: order.recipientLabel,
        amount: order.amount,
        completedAt: order.updatedAt,
      });
      setPendingGiftCard(null);
      setPollAttemptCount(0);
      return;
    }

    setCompletedGiftCard(null);
    setPendingGiftCard(nextPending);
  }

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const paymentState = searchParams.get("payment");

    if (!orderId) {
      if (paymentState === "cancelled") {
        setStatusMessage(resolveLocalizedText(giftCardCopy.paymentCancelled, locale));
      }
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          throw new Error(payload.error || resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
        }

        applyTrackedOrder(payload.order);
        if (paymentState === "success") {
          setStatusMessage(resolveLocalizedText(giftCardCopy.processingStatus, locale));
        }
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
      }
    })();
  }, [locale, searchParams]);

  useEffect(() => {
    if (!pendingGiftCard || pendingGiftCard.rechargeCode || pendingGiftCard.customerStatus === "refunded" || pendingGiftCard.customerStatus === "failed") {
      return;
    }

    let cancelled = false;
    const pollingDelay = Math.min(
      SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS * Math.max(1, pollAttemptCount + 1),
      SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS
    );

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingGiftCard.orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          if (!cancelled) {
            setPollAttemptCount((current) => current + 1);
            if (response.status !== 429) {
              setStatusMessage(payload.error || resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
            }
          }
          return;
        }

        if (!cancelled) {
          setPollAttemptCount(payload.order.rechargeCode ? 0 : (current) => current + 1);
          applyTrackedOrder(payload.order);
        }
      } catch {
        if (!cancelled) {
          setPollAttemptCount((current) => current + 1);
          setStatusMessage(resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
        }
      }
    }, pollingDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [locale, pendingGiftCard, pollAttemptCount]);

  const normalizedWhatsappTarget = recipientContact.replace(/\D/g, "");
  const whatsappHref = normalizedWhatsappTarget && completedGiftCard?.rechargeCode
    ? `https://wa.me/${normalizedWhatsappTarget}?text=${encodeURIComponent(`Code Jumia: ${completedGiftCard.rechargeCode}`)}`
    : null;
  const emailHref = recipientContact.includes("@") && completedGiftCard?.rechargeCode
    ? `mailto:${encodeURIComponent(recipientContact)}?subject=${encodeURIComponent("Code Jumia Côte d'Ivoire")}&body=${encodeURIComponent(`Bonjour,\n\nVoici votre code Jumia : ${completedGiftCard.rechargeCode}\nRéférence Afrisendiq : ${completedGiftCard.reference}`)}`
    : null;

  const completionView = completedGiftCard ? (
    <SoutraliCodeReadyCard
      kind="gift-card"
      locale={locale}
      title={resolveLocalizedText(giftCardCopy.codeReadyTitle, locale)}
      description={resolveLocalizedText(giftCardCopy.codeReadyDescription, locale)}
      primaryLabel={resolveLocalizedText(giftCardCopy.codeLabel, locale)}
      primaryValue={completedGiftCard.rechargeCode}
      productName={completedGiftCard.productName}
      amountLabel={`${completedGiftCard.amount.toLocaleString()} XOF`}
      logoSrc={selectedProduct?.serviceLogoPath}
      logoAlt="Soutrali Jumia gift card logo"
      recipientName={completedGiftCard.recipientName}
      recipientContact={completedGiftCard.recipientContact}
      detailLabel={resolveLocalizedText(giftCardCopy.recipientChannel, locale)}
      detailValue={completedGiftCard.recipientContact}
      referenceLabel={resolveLocalizedText(giftCardCopy.orderReference, locale)}
      referenceValue={completedGiftCard.reference}
      note={resolveLocalizedText(giftCardCopy.completionNote, locale)}
      completedAt={completedGiftCard.completedAt}
      actions={
        <>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(completedGiftCard.rechargeCode);
              setStatusMessage(resolveLocalizedText(giftCardCopy.copiedCode, locale));
            }}
            className="rounded-full bg-[#0E2E23] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#154335]"
          >
            {resolveLocalizedText(giftCardCopy.copyCode, locale)}
          </button>
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
              {resolveLocalizedText(giftCardCopy.shareWhatsapp, locale)}
            </a>
          ) : null}
          {emailHref ? (
            <a href={emailHref} className="rounded-full border border-orange-300 bg-white px-5 py-3 text-sm font-semibold text-orange-900 transition hover:bg-orange-100">
              {resolveLocalizedText(giftCardCopy.shareEmail, locale)}
            </a>
          ) : null}
          <a href="https://www.jumia.ci" target="_blank" rel="noreferrer" className="rounded-full border border-orange-300 bg-white px-5 py-3 text-sm font-semibold text-orange-900 transition hover:bg-orange-100">
            {resolveLocalizedText(giftCardCopy.openJumia, locale)}
          </a>
        </>
      }
      footerAction={
        <button
          type="button"
          onClick={clearCompletedGiftCard}
          className="w-full rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          {resolveLocalizedText(giftCardCopy.sendAnother, locale)}
        </button>
      }
    />
  ) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#6b1a3a_0%,#1a0510_42%,#0d0608_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <AfriSendIQBrand className="max-w-xl" />
          <CoteDIvoireLanguageSwitch />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[2rem] border border-pink-400/15 bg-pink-900/20 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-pink-200/82">
              <span>{resolveLocalizedText(giftCardCopy.eyebrow, locale)}</span>
              <Link href="/cote-divoire" className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[11px] text-white transition hover:bg-white/12">
                {resolveLocalizedText(giftCardCopy.backToHub, locale)}
              </Link>
            </div>

            <div className="mt-4">
              <CoteDIvoireSectionHeading
                locale={locale}
                eyebrow={giftCardCopy.eyebrow}
                title={giftCardCopy.title}
                description={giftCardCopy.description}
              />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/15 p-5">
              <CoteDIvoireSectionHeading
                locale={locale}
                eyebrow={{ fr: "Soutrali guide", en: "Soutrali guide" }}
                title={giftCardCopy.howToTitle}
              />
              <ol className="mt-4 space-y-3 text-sm leading-7 text-pink-50/80">
                {howToSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-xs font-semibold text-orange-200">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-orange-200/88">
              {resolveLocalizedText(giftCardCopy.signature, locale)}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-pink-200/70">{resolveLocalizedText(giftCardCopy.provider, locale)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-orange-500/20 px-3 py-1 text-orange-300">JUMIA</span>
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-pink-200/70">{resolveLocalizedText(giftCardCopy.country, locale)}</div>
                <div className="mt-2 text-lg font-semibold">🇨🇮 Côte d&apos;Ivoire</div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-pink-200/70">{resolveLocalizedText(giftCardCopy.currentAmount, locale)}</div>
                <div className="mt-2 text-lg font-semibold">{amount.toLocaleString()} XOF</div>
              </div>
            </div>

            <div className="mt-6">
              <CoteDIvoireHeroPanel
                badge={resolveLocalizedText(giftCardCopy.eyebrow, locale)}
                gradientClass="from-[#C2410C] via-[#EA580C] to-[#FB923C]"
                imageSrcs={coteDivoireVisualAssets.giftCards}
                imageAlt={resolveLocalizedText(giftCardCopy.title, locale)}
                contextLabel="🇨🇮 Soutrali Jumia"
                wordmark="JUMIA"
                heightClassName="min-h-[16rem]"
              />
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(3,12,9,0.18)]">
            {completionView ? (
              completionView
            ) : pendingGiftCard ? (
              <div className="rounded-[1.6rem] border border-pink-200 bg-pink-50 p-5 text-[#7b284d]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-pink-700">{resolveLocalizedText(giftCardCopy.pendingTitle, locale)}</div>
                    <p className="mt-1 text-sm leading-6 text-pink-900">{resolveLocalizedText(giftCardCopy.pendingDescription, locale)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-white/90 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{resolveLocalizedText(giftCardCopy.pendingReference, locale)}</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{pendingGiftCard.reference || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AfriSendIQ</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{resolveLocalizedText(giftCardCopy.pendingStatus, locale).replace("{status}", formatCustomerStatus(pendingGiftCard.customerStatus))}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-pink-900">
                  {pendingGiftCard.customerStatus === "refunded"
                    ? resolveLocalizedText(giftCardCopy.refundedMessage, locale)
                    : pendingGiftCard.customerStatus === "failed"
                      ? resolveLocalizedText(giftCardCopy.failedMessage, locale)
                      : resolveLocalizedText(giftCardCopy.pendingPolling, locale)}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setPollAttemptCount(0);
                      try {
                        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingGiftCard.orderId)}`);
                        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;
                        if (response.ok && payload.success && payload.order) {
                          applyTrackedOrder(payload.order);
                        } else {
                          setStatusMessage(payload.error || resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
                        }
                      } catch {
                        setStatusMessage(resolveLocalizedText(giftCardCopy.statusLookupFailed, locale));
                      }
                    }}
                    className="rounded-full border border-pink-300 bg-white px-4 py-2 text-sm font-semibold text-pink-900 transition hover:bg-pink-100"
                  >
                    {resolveLocalizedText(giftCardCopy.refreshStatus, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={clearCompletedGiftCard}
                    className="rounded-full border border-pink-200 bg-pink-100/70 px-4 py-2 text-sm font-semibold text-pink-950 transition hover:bg-pink-200"
                  >
                    {resolveLocalizedText(giftCardCopy.clearTrackedTransaction, locale)}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <CoteDIvoireSectionHeading
                  locale={locale}
                  eyebrow={{ fr: "Soutrali workflow", en: "Soutrali workflow" }}
                  title={{ fr: "Envoyer la carte cadeau", en: "Send the gift card" }}
                  description={giftCardCopy.orderDescription}
                />

                <label className="block text-sm font-semibold">{resolveLocalizedText(giftCardCopy.recipientEmail, locale)}</label>
                <input
                  type="text"
                  placeholder="email@exemple.com / +225..."
                  value={recipientContact}
                  onChange={(e) => {
                    setRecipientContact(e.target.value);
                    setStatusMessage(null);
                  }}
                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3"
                />

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(giftCardCopy.recipientName, locale)}</label>
                <input
                  type="text"
                  placeholder="Nom du bénéficiaire"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    setStatusMessage(null);
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(giftCardCopy.selectProduct, locale)}</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const nextProductId = e.target.value;
                    setSelectedProductId(nextProductId);
                    const nextProduct = products.find((product) => product.id === nextProductId);
                    if (nextProduct?.amountOptions?.length) {
                      setAmount(nextProduct.amountOptions[0]);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-600"
                >
                  <option value="">{resolveLocalizedText(giftCardCopy.chooseProduct, locale)}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(giftCardCopy.amount, locale)}</label>
                <select
                  value={amount.toString()}
                  onChange={(e) => setAmount(Number.parseInt(e.target.value, 10))}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-600"
                >
                  {(selectedProduct?.amountOptions || []).map((value) => (
                    <option key={value} value={value.toString()}>
                      {value.toLocaleString()} XOF
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3 text-sm text-pink-900">
                    <CoteDIvoireServiceLogo
                      src={selectedProduct.serviceLogoPath}
                      alt={`${selectedProduct.name} logo`}
                      className="h-12 w-12 rounded-xl border-pink-100 p-1.5"
                    />
                    <span>
                      {resolveLocalizedText(giftCardCopy.selectedProduct, locale)}: <span className="font-semibold">{selectedProduct.name}</span>
                    </span>
                  </div>
                )}

                {statusMessage && (
                  <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                    {statusMessage}
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!recipientContact.trim()) {
                      setStatusMessage(resolveLocalizedText(giftCardCopy.enterRecipient, locale));
                      return;
                    }

                    if (!recipientName.trim()) {
                      setStatusMessage(resolveLocalizedText(giftCardCopy.enterName, locale));
                      return;
                    }

                    if (!selectedProductId) {
                      setStatusMessage(resolveLocalizedText(giftCardCopy.selectBeforeContinue, locale));
                      return;
                    }

                    setSubmitting(true);
                    setStatusMessage(resolveLocalizedText(giftCardCopy.routing, locale));

                    try {
                      const res = await fetch("/api/soutrali/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: selectedProductId,
                          customerReference: recipientContact,
                          recipientLabel: recipientName,
                          amount
                        })
                      });

                      const data = (await res.json()) as SoutraliTrackedCheckoutResponse;

                      if (data.success && data.orderId && data.checkoutUrl) {
                        setPendingGiftCard({
                          orderId: data.orderId,
                          customerStatus: "awaiting_payment",
                          reference: null,
                          rechargeCode: null,
                          quotedPrice: data.quotedPrice,
                          productName: selectedProduct?.name || "Soutrali Jumia",
                          recipientContact,
                          recipientName,
                          amount,
                        });
                        setCompletedGiftCard(null);
                        setStatusMessage(resolveLocalizedText(giftCardCopy.redirectingToPayment, locale));
                        window.location.assign(data.checkoutUrl);
                        return;
                      }

                      if (!data.success) {
                        setStatusMessage(data.error || resolveLocalizedText(giftCardCopy.paymentFailed, locale));
                      } else {
                        setStatusMessage(resolveLocalizedText(giftCardCopy.endpointFailed, locale));
                      }
                    } catch {
                      setStatusMessage(resolveLocalizedText(giftCardCopy.endpointFailed, locale));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="mt-6 w-full rounded-xl bg-[#C2410C] px-4 py-3 font-semibold text-white transition hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:bg-orange-900/50"
                >
                  {submitting ? resolveLocalizedText(giftCardCopy.submitting, locale) : resolveLocalizedText(giftCardCopy.continue, locale)}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function JumiaGiftCardPage() {
  return (
    <Suspense fallback={null}>
      <JumiaGiftCardPageContent />
    </Suspense>
  );
}