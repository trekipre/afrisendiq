"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel";
import { CoteDIvoireServiceLogo } from "@/app/components/CoteDIvoireServiceLogo";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { SoutraliCodeReadyCard } from "@/app/components/SoutraliCodeReadyCard";
import { resolveLocalizedText, useCoteDIvoireLocale } from "@/app/components/CoteDIvoireLocale";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";
import {
  isSoutraliTrackedSuccessStatus,
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
  category?: string;
  amountOptions: number[];
  recipientLabel: string;
  customerReferenceLabel: string;
  serviceLogoPath?: string;
};

type CompletedAirtimeState = {
  reference: string;
  productName: string;
  recipientPhone: string;
  amount: number;
  completedAt?: string;
};

type PendingAirtimeState = {
  orderId: string;
  customerStatus: SoutraliTrackedCustomerStatus;
  reference?: string | null;
  quotedPrice?: number;
  productName: string;
  recipientPhone: string;
  amount: number;
  completedAt?: string;
};

const AIRTIME_COMPLETION_STORAGE_KEY = "afrisendiq-ci-airtime-completion";
const AIRTIME_PENDING_STORAGE_KEY = "afrisendiq-ci-airtime-pending-order";

const phoneTopUpCopy = {
  eyebrow: { fr: "RECHARGE MOBILE", en: "Phone Top-Up" },
  backToHub: { fr: "Retour", en: "Back" },
  title: { fr: "RECHARGE MOBILE CÔTE D'IVOIRE", en: "Côte d'Ivoire Phone Top-Up" },
  description: {
    fr: "Rechargez un numéro MTN, Orange ou Moov en Côte d'Ivoire.",
    en: "Top up an MTN, Orange, or Moov number in Côte d'Ivoire."
  },
  operators: { fr: "Opérateurs", en: "Operators" },
  countryCode: { fr: "Indicatif", en: "Country code" },
  currentAmount: { fr: "Montant", en: "Amount" },
  phoneNumber: { fr: "Numéro de téléphone", en: "Phone number" },
  selectProduct: { fr: "Choisir un produit", en: "Select a product" },
  chooseProduct: { fr: "Choisissez un produit", en: "Choose a product" },
  amount: { fr: "Montant", en: "Amount" },
  selectedProduct: { fr: "Produit sélectionné", en: "Selected product" },
  enterPhone: { fr: "Veuillez entrer un numéro de téléphone.", en: "Please enter a phone number." },
  selectBeforeContinue: { fr: "Veuillez choisir un produit.", en: "Please select a product." },
  routing: { fr: "Préparation du paiement sécurisé...", en: "Preparing secure payment..." },
  redirectingToPayment: { fr: "Redirection vers Stripe pour finaliser le paiement...", en: "Redirecting to Stripe to complete payment..." },
  paymentCancelled: { fr: "Le paiement a été annulé avant confirmation. Vous pouvez réessayer.", en: "Payment was cancelled before confirmation. You can try again." },
  rechargeFailed: { fr: "Échec de la recharge.", en: "Top-up failed." },
  endpointFailed: { fr: "Service temporairement indisponible. Veuillez réessayer.", en: "Service temporarily unavailable. Please try again." },
  submitting: { fr: "Envoi...", en: "Sending..." },
  continue: { fr: "Envoyer la recharge", en: "Send top-up" },
  pendingTitle: { fr: "Recharge en cours de traitement", en: "Top-up being processed" },
  pendingDescription: { fr: "Le paiement est reçu ou en cours de confirmation. AfriSendIQ finalise maintenant la recharge auprès du réseau mobile.", en: "The payment has been received or is being confirmed. AfriSendIQ is now completing the top-up with the mobile network." },
  pendingReference: { fr: "Référence AfriSendIQ", en: "AfriSendIQ reference" },
  pendingStatus: { fr: "Statut AfriSendIQ : {status}", en: "AfriSendIQ status: {status}" },
  pendingPolling: { fr: "Le suivi se met à jour automatiquement jusqu'à la livraison réseau ou au remboursement.", en: "Tracking refreshes automatically until network delivery or refund." },
  paymentReceivedStatus: { fr: "Paiement confirmé", en: "Payment confirmed" },
  processingStatus: { fr: "Recharge réseau en cours", en: "Network top-up in progress" },
  refundedStatus: { fr: "Paiement remboursé", en: "Payment refunded" },
  failedStatus: { fr: "Traitement interrompu", en: "Processing interrupted" },
  refreshStatus: { fr: "Actualiser le statut", en: "Refresh status" },
  clearTrackedTransaction: { fr: "Effacer le suivi", en: "Clear tracked transaction" },
  statusLookupFailed: { fr: "Impossible de récupérer le suivi pour le moment. Réessayez dans quelques instants.", en: "Unable to retrieve tracking right now. Try again shortly." },
  refundedMessage: { fr: "Le paiement a été remboursé automatiquement. Aucun débit fournisseur définitif n'a été conservé côté client.", en: "The payment was refunded automatically. No final provider charge was kept on the customer side." },
  failedMessage: { fr: "La recharge n'a pas pu être finalisée. Réessayez ou contactez AfriSendIQ si le statut reste bloqué.", en: "The top-up could not be finalized. Retry or contact AfriSendIQ if the status remains stuck." },
  readyTitle: { fr: "Recharge livrée", en: "Top-up delivered" },
  readyDescription: { fr: "Les unités sont parties. Vous pouvez confirmer la livraison avec votre proche ou relancer une nouvelle recharge.", en: "The airtime has been sent. You can confirm delivery with your recipient or send another top-up." },
  primaryLabel: { fr: "Statut", en: "Status" },
  primaryValue: { fr: "Livré au réseau", en: "Delivered to network" },
  detailLabel: { fr: "Numéro rechargé", en: "Recharged number" },
  referenceLabel: { fr: "Référence de commande", en: "Order reference" },
  note: { fr: "Demandez au bénéficiaire de vérifier son solde ou ses unités reçues sur son téléphone.", en: "Ask the recipient to check their balance or received units on their phone." },
  shareWhatsapp: { fr: "Partager via WhatsApp", en: "Share via WhatsApp" },
  copiedReference: { fr: "Référence copiée.", en: "Reference copied." },
  copyReference: { fr: "Copier la référence", en: "Copy reference" },
  sendAnother: { fr: "Envoyer une nouvelle recharge", en: "Send another top-up" }
};

function PhoneTopUpPageContent() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [products, setProducts] = useState<SoutraliProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [amount, setAmount] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [completedTopUp, setCompletedTopUp] = useState<CompletedAirtimeState | null>(null);
  const [pendingTopUp, setPendingTopUp] = useState<PendingAirtimeState | null>(null);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const { locale } = useCoteDIvoireLocale();

  const selectedProduct = products.find((product) => product.id === selectedProductId) || null;

  useEffect(() => {
    try {
      const storedCompletion = window.localStorage.getItem(AIRTIME_COMPLETION_STORAGE_KEY);
      if (!storedCompletion) {
        return;
      }

      const parsedCompletion = JSON.parse(storedCompletion) as CompletedAirtimeState;
      if (!parsedCompletion?.reference || !parsedCompletion?.recipientPhone) {
        window.localStorage.removeItem(AIRTIME_COMPLETION_STORAGE_KEY);
        return;
      }

      setCompletedTopUp(parsedCompletion);
      setPhone(parsedCompletion.recipientPhone);
      setAmount(parsedCompletion.amount || 1000);
    } catch {
      window.localStorage.removeItem(AIRTIME_COMPLETION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const storedPending = window.localStorage.getItem(AIRTIME_PENDING_STORAGE_KEY);
      if (!storedPending) {
        return;
      }

      const parsedPending = JSON.parse(storedPending) as PendingAirtimeState;
      if (!parsedPending?.orderId || !parsedPending?.customerStatus) {
        window.localStorage.removeItem(AIRTIME_PENDING_STORAGE_KEY);
        return;
      }

      setPendingTopUp(parsedPending);
      setPhone(parsedPending.recipientPhone || "");
      setAmount(parsedPending.amount || 1000);
    } catch {
      window.localStorage.removeItem(AIRTIME_PENDING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!completedTopUp) {
      window.localStorage.removeItem(AIRTIME_COMPLETION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(AIRTIME_COMPLETION_STORAGE_KEY, JSON.stringify(completedTopUp));
  }, [completedTopUp]);

  useEffect(() => {
    if (!pendingTopUp) {
      window.localStorage.removeItem(AIRTIME_PENDING_STORAGE_KEY);
      setPollAttemptCount(0);
      return;
    }

    window.localStorage.setItem(AIRTIME_PENDING_STORAGE_KEY, JSON.stringify(pendingTopUp));
  }, [pendingTopUp]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/soutrali/products?category=airtime");
        const payload = await response.json();

        if (response.ok && payload.success) {
          setProducts(payload.products || []);
          setSelectedProductId(payload.products?.[0]?.id || "");
          const firstAmount = payload.products?.[0]?.amountOptions?.[0];
          if (typeof firstAmount === "number") {
            setAmount(firstAmount);
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
      return resolveLocalizedText(phoneTopUpCopy.paymentReceivedStatus, locale);
    }

    if (status === "processing") {
      return resolveLocalizedText(phoneTopUpCopy.processingStatus, locale);
    }

    if (status === "refunded") {
      return resolveLocalizedText(phoneTopUpCopy.refundedStatus, locale);
    }

    if (status === "failed") {
      return resolveLocalizedText(phoneTopUpCopy.failedStatus, locale);
    }

    return resolveLocalizedText(phoneTopUpCopy.processingStatus, locale);
  }

  function applyTrackedOrder(order: SoutraliTrackedOrderCustomerView) {
    const nextPending = {
      orderId: order.id,
      customerStatus: order.customerStatus,
      reference: order.reference,
      quotedPrice: order.quotedPrice,
      productName: order.productName,
      recipientPhone: order.customerReference,
      amount: order.amount,
      completedAt: isSoutraliTrackedSuccessStatus(order.customerStatus) ? order.updatedAt : undefined,
    } satisfies PendingAirtimeState;

    setPhone(order.customerReference);
    setAmount(order.amount);

    if (order.customerStatus === "completed") {
      setCompletedTopUp({
        reference: order.reference || order.id,
        productName: order.productName,
        recipientPhone: order.customerReference,
        amount: order.amount,
        completedAt: order.updatedAt,
      });
      setPendingTopUp(null);
      setPollAttemptCount(0);
      return;
    }

    setCompletedTopUp(null);
    setPendingTopUp(nextPending);
  }

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const paymentState = searchParams.get("payment");

    if (!orderId) {
      if (paymentState === "cancelled") {
        setStatusMessage(resolveLocalizedText(phoneTopUpCopy.paymentCancelled, locale));
      }
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          throw new Error(payload.error || resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
        }

        applyTrackedOrder(payload.order);
        if (paymentState === "success") {
          setStatusMessage(resolveLocalizedText(phoneTopUpCopy.processingStatus, locale));
        }
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
      }
    })();
  }, [locale, searchParams]);

  useEffect(() => {
    if (!pendingTopUp || pendingTopUp.customerStatus === "completed" || pendingTopUp.customerStatus === "refunded" || pendingTopUp.customerStatus === "failed") {
      return;
    }

    let cancelled = false;
    const pollingDelay = Math.min(
      SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS * Math.max(1, pollAttemptCount + 1),
      SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS
    );

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingTopUp.orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          if (!cancelled) {
            setPollAttemptCount((current) => current + 1);
            if (response.status !== 429) {
              setStatusMessage(payload.error || resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
            }
          }
          return;
        }

        if (!cancelled) {
          setPollAttemptCount(isSoutraliTrackedSuccessStatus(payload.order.customerStatus) ? 0 : (current) => current + 1);
          applyTrackedOrder(payload.order);
        }
      } catch {
        if (!cancelled) {
          setPollAttemptCount((current) => current + 1);
          setStatusMessage(resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
        }
      }
    }, pollingDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [locale, pendingTopUp, pollAttemptCount]);

  const clearTrackedTransaction = () => {
    setPendingTopUp(null);
    setCompletedTopUp(null);
    setStatusMessage(null);
    setPollAttemptCount(0);
  };

  const detectOperator = (value: string) => {
    if (value.startsWith("+22505")) {
      setSelectedProductId("soutrali-ci-mtn-airtime");
    } else if (value.startsWith("+22507")) {
      setSelectedProductId("soutrali-ci-orange-airtime");
    } else if (value.startsWith("+22501")) {
      setSelectedProductId("soutrali-ci-moov-airtime");
    }
  };

  const whatsappHref = completedTopUp
    ? `https://wa.me/${completedTopUp.recipientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Recharge envoyée. Référence Afrisendiq : ${completedTopUp.reference}`)}`
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1a6a4b_0%,#0d261d_42%,#08140f_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <AfriSendIQBrand className="max-w-xl" />
          <CoteDIvoireLanguageSwitch />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/82">
              <span>{resolveLocalizedText(phoneTopUpCopy.eyebrow, locale)}</span>
              <Link href="/cote-divoire" className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[11px] text-white transition hover:bg-white/12">
                {resolveLocalizedText(phoneTopUpCopy.backToHub, locale)}
              </Link>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
              {resolveLocalizedText(phoneTopUpCopy.title, locale)}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78">
              {resolveLocalizedText(phoneTopUpCopy.description, locale)}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{resolveLocalizedText(phoneTopUpCopy.operators, locale)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-[#FFD200]/20 px-3 py-1 text-[#FFD200]">MTN</span>
                  <span className="rounded-full bg-[#FF7900]/20 px-3 py-1 text-[#FF7900]">Orange</span>
                  <span className="rounded-full bg-[#3B82F6]/20 px-3 py-1 text-[#60A5FA]">Moov</span>
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{resolveLocalizedText(phoneTopUpCopy.countryCode, locale)}</div>
                <div className="mt-2 text-lg font-semibold">+225</div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{resolveLocalizedText(phoneTopUpCopy.currentAmount, locale)}</div>
                <div className="mt-2 text-lg font-semibold">{amount.toLocaleString()} XOF</div>
              </div>
            </div>

            <div className="mt-6">
              <CoteDIvoireHeroPanel
                badge={resolveLocalizedText(phoneTopUpCopy.eyebrow, locale)}
                gradientClass="from-[#FFD200] via-[#FFBA00] to-[#FF8C00]"
                imageSrcs={coteDivoireVisualAssets.airtime}
                imageAlt={resolveLocalizedText(phoneTopUpCopy.title, locale)}
                contextLabel="Soutrali · Côte d'Ivoire"
                heightClassName="min-h-[16rem]"
              />
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(3,12,9,0.18)]">
            {completedTopUp ? (
              <SoutraliCodeReadyCard
                kind="airtime"
                locale={locale}
                title={resolveLocalizedText(phoneTopUpCopy.readyTitle, locale)}
                description={resolveLocalizedText(phoneTopUpCopy.readyDescription, locale)}
                primaryLabel={resolveLocalizedText(phoneTopUpCopy.primaryLabel, locale)}
                primaryValue={resolveLocalizedText(phoneTopUpCopy.primaryValue, locale)}
                productName={completedTopUp.productName}
                amountLabel={`${completedTopUp.amount.toLocaleString()} XOF`}
                logoSrc={selectedProduct?.serviceLogoPath}
                logoAlt="Soutrali airtime logo"
                recipientName={completedTopUp.recipientPhone}
                detailLabel={resolveLocalizedText(phoneTopUpCopy.detailLabel, locale)}
                detailValue={completedTopUp.recipientPhone}
                referenceLabel={resolveLocalizedText(phoneTopUpCopy.referenceLabel, locale)}
                referenceValue={completedTopUp.reference}
                note={resolveLocalizedText(phoneTopUpCopy.note, locale)}
                completedAt={completedTopUp.completedAt}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(completedTopUp.reference);
                        setStatusMessage(resolveLocalizedText(phoneTopUpCopy.copiedReference, locale));
                      }}
                      className="rounded-full bg-[#0E2E23] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#145440]"
                    >
                      {resolveLocalizedText(phoneTopUpCopy.copyReference, locale)}
                    </button>
                    {whatsappHref ? (
                      <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                        {resolveLocalizedText(phoneTopUpCopy.shareWhatsapp, locale)}
                      </a>
                    ) : null}
                  </>
                }
                footerAction={
                  <button
                    type="button"
                    onClick={() => {
                      clearTrackedTransaction();
                    }}
                    className="w-full rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    {resolveLocalizedText(phoneTopUpCopy.sendAnother, locale)}
                  </button>
                }
              />
            ) : pendingTopUp ? (
              <div className="rounded-[1.6rem] border border-emerald-200 bg-emerald-50 p-5 text-[#0f5132]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{resolveLocalizedText(phoneTopUpCopy.pendingTitle, locale)}</div>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{resolveLocalizedText(phoneTopUpCopy.pendingDescription, locale)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-white/90 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{resolveLocalizedText(phoneTopUpCopy.pendingReference, locale)}</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{pendingTopUp.reference || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AfriSendIQ</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{resolveLocalizedText(phoneTopUpCopy.pendingStatus, locale).replace("{status}", formatCustomerStatus(pendingTopUp.customerStatus))}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-emerald-900">
                  {pendingTopUp.customerStatus === "refunded"
                    ? resolveLocalizedText(phoneTopUpCopy.refundedMessage, locale)
                    : pendingTopUp.customerStatus === "failed"
                      ? resolveLocalizedText(phoneTopUpCopy.failedMessage, locale)
                      : resolveLocalizedText(phoneTopUpCopy.pendingPolling, locale)}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setPollAttemptCount(0);
                      try {
                        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingTopUp.orderId)}`);
                        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;
                        if (response.ok && payload.success && payload.order) {
                          applyTrackedOrder(payload.order);
                        } else {
                          setStatusMessage(payload.error || resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
                        }
                      } catch {
                        setStatusMessage(resolveLocalizedText(phoneTopUpCopy.statusLookupFailed, locale));
                      }
                    }}
                    className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    {resolveLocalizedText(phoneTopUpCopy.refreshStatus, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={clearTrackedTransaction}
                    className="rounded-full border border-emerald-200 bg-emerald-100/70 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
                  >
                    {resolveLocalizedText(phoneTopUpCopy.clearTrackedTransaction, locale)}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold">{resolveLocalizedText(phoneTopUpCopy.phoneNumber, locale)}</label>
                <input
                  type="text"
                  placeholder="+2250708123456"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPhone(value);
                    setStatusMessage(null);
                    detectOperator(value);
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(phoneTopUpCopy.selectProduct, locale)}</label>
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
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">{resolveLocalizedText(phoneTopUpCopy.chooseProduct, locale)}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(phoneTopUpCopy.amount, locale)}</label>
                <select
                  value={amount.toString()}
                  onChange={(e) => setAmount(Number.parseInt(e.target.value, 10))}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {(selectedProduct?.amountOptions || []).map((value) => (
                    <option key={value} value={value.toString()}>
                      {value.toLocaleString()} XOF
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <CoteDIvoireServiceLogo
                      src={selectedProduct.serviceLogoPath}
                      alt={`${selectedProduct.name} logo`}
                      className="h-12 w-12 rounded-xl border-emerald-100 p-1.5"
                    />
                    <span>
                      {resolveLocalizedText(phoneTopUpCopy.selectedProduct, locale)}: <span className="font-semibold">{selectedProduct.name}</span>
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
                    if (!phone.trim()) {
                      setStatusMessage(resolveLocalizedText(phoneTopUpCopy.enterPhone, locale));
                      return;
                    }

                    if (!selectedProductId) {
                      setStatusMessage(resolveLocalizedText(phoneTopUpCopy.selectBeforeContinue, locale));
                      return;
                    }

                    setSubmitting(true);
                    setStatusMessage(resolveLocalizedText(phoneTopUpCopy.routing, locale));

                    try {
                      const res = await fetch("/api/soutrali/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: selectedProductId,
                          customerReference: phone,
                          recipientLabel: phone,
                          amount
                        })
                      });

                      const data = (await res.json()) as SoutraliTrackedCheckoutResponse;

                      if (data.success && data.orderId && data.checkoutUrl) {
                        setPendingTopUp({
                          orderId: data.orderId,
                          customerStatus: "awaiting_payment",
                          reference: null,
                          quotedPrice: data.quotedPrice,
                          productName: selectedProduct?.name || "Soutrali airtime",
                          recipientPhone: phone,
                          amount,
                        });
                        setCompletedTopUp(null);
                        setStatusMessage(resolveLocalizedText(phoneTopUpCopy.redirectingToPayment, locale));
                        window.location.assign(data.checkoutUrl);
                        return;
                      }

                      if (!data.success) {
                        setStatusMessage(data.error || resolveLocalizedText(phoneTopUpCopy.rechargeFailed, locale));
                      } else {
                        setStatusMessage(resolveLocalizedText(phoneTopUpCopy.endpointFailed, locale));
                      }
                    } catch {
                      setStatusMessage(resolveLocalizedText(phoneTopUpCopy.endpointFailed, locale));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="mt-6 w-full rounded-xl bg-[#0F3D2E] px-4 py-3 font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:bg-[#4d6a5f]"
                >
                  {submitting ? resolveLocalizedText(phoneTopUpCopy.submitting, locale) : resolveLocalizedText(phoneTopUpCopy.continue, locale)}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function PhoneTopUpPage() {
  return (
    <Suspense fallback={null}>
      <PhoneTopUpPageContent />
    </Suspense>
  );
}