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
  amountOptions: number[];
  recipientLabel: string;
  customerReferenceLabel: string;
  serviceLogoPath?: string;
  dataAllowance?: string;
  validity?: string;
};

type Operator = "MTN" | "ORANGE" | "MOOV";

type CompletedDataState = {
  reference: string;
  productName: string;
  recipientPhone: string;
  amount: number;
  dataAllowance?: string;
  validity?: string;
  completedAt?: string;
};

type PendingDataState = {
  orderId: string;
  customerStatus: SoutraliTrackedCustomerStatus;
  reference?: string | null;
  quotedPrice?: number;
  productName: string;
  recipientPhone: string;
  amount: number;
  dataAllowance?: string;
  validity?: string;
  completedAt?: string;
};

const DATA_COMPLETION_STORAGE_KEY = "afrisendiq-ci-data-completion";
const DATA_PENDING_STORAGE_KEY = "afrisendiq-ci-data-pending-order";

const operators: { key: Operator; label: string; color: string; bg: string }[] = [
  { key: "MTN", label: "MTN", color: "text-[#FFD200]", bg: "bg-[#FFD200]/20" },
  { key: "ORANGE", label: "Orange", color: "text-[#FF7900]", bg: "bg-[#FF7900]/20" },
  { key: "MOOV", label: "Moov", color: "text-[#60A5FA]", bg: "bg-[#3B82F6]/20" },
];

const dataTopUpCopy = {
  eyebrow: { fr: "CONNEXION", en: "Data Top-Up" },
  backToHub: { fr: "Retour", en: "Back" },
  title: { fr: "CONNEXION CÔTE D'IVOIRE", en: "Côte d'Ivoire Data Top-Up" },
  description: {
    fr: "Rechargez un forfait internet MTN, Orange ou Moov en Côte d'Ivoire.",
    en: "Top up an MTN, Orange, or Moov data bundle in Côte d'Ivoire."
  },
  operator: { fr: "Opérateur", en: "Operator" },
  countryCode: { fr: "Indicatif", en: "Country code" },
  phoneNumber: { fr: "Numéro de téléphone", en: "Phone number" },
  selectBundle: { fr: "Choisir un forfait", en: "Select a bundle" },
  chooseBundle: { fr: "Choisissez un forfait", en: "Choose a bundle" },
  selectedBundle: { fr: "Forfait sélectionné", en: "Selected bundle" },
  price: { fr: "Prix", en: "Price" },
  enterPhone: { fr: "Veuillez entrer un numéro de téléphone.", en: "Please enter a phone number." },
  selectBeforeContinue: { fr: "Veuillez choisir un forfait.", en: "Please select a bundle." },
  routing: { fr: "Préparation du paiement sécurisé...", en: "Preparing secure payment..." },
  redirectingToPayment: { fr: "Redirection vers Stripe pour finaliser le paiement...", en: "Redirecting to Stripe to complete payment..." },
  paymentCancelled: { fr: "Le paiement a été annulé avant confirmation. Vous pouvez réessayer.", en: "Payment was cancelled before confirmation. You can try again." },
  rechargeFailed: { fr: "Échec de la recharge.", en: "Top-up failed." },
  endpointFailed: { fr: "Service temporairement indisponible. Veuillez réessayer.", en: "Service temporarily unavailable. Please try again." },
  submitting: { fr: "Envoi...", en: "Sending..." },
  continue: { fr: "Envoyer le forfait", en: "Send data bundle" },
  noBundle: { fr: "Aucun forfait disponible pour cet opérateur.", en: "No bundles available for this operator." },
  pendingTitle: { fr: "Forfait en cours de traitement", en: "Bundle being processed" },
  pendingDescription: { fr: "Le paiement est reçu ou en cours de confirmation. AfriSendIQ active maintenant le forfait auprès de l'opérateur.", en: "The payment has been received or is being confirmed. AfriSendIQ is now activating the bundle with the operator." },
  pendingReference: { fr: "Référence AfriSendIQ", en: "AfriSendIQ reference" },
  pendingStatus: { fr: "Statut AfriSendIQ : {status}", en: "AfriSendIQ status: {status}" },
  pendingPolling: { fr: "Le suivi se met à jour automatiquement jusqu'à l'activation finale ou au remboursement.", en: "Tracking refreshes automatically until final activation or refund." },
  paymentReceivedStatus: { fr: "Paiement confirmé", en: "Payment confirmed" },
  processingStatus: { fr: "Activation réseau en cours", en: "Network activation in progress" },
  refundedStatus: { fr: "Paiement remboursé", en: "Payment refunded" },
  failedStatus: { fr: "Traitement interrompu", en: "Processing interrupted" },
  refreshStatus: { fr: "Actualiser le statut", en: "Refresh status" },
  clearTrackedTransaction: { fr: "Effacer le suivi", en: "Clear tracked transaction" },
  statusLookupFailed: { fr: "Impossible de récupérer le suivi pour le moment. Réessayez dans quelques instants.", en: "Unable to retrieve tracking right now. Try again shortly." },
  refundedMessage: { fr: "Le paiement a été remboursé automatiquement. Aucun débit fournisseur définitif n'a été conservé côté client.", en: "The payment was refunded automatically. No final provider charge was kept on the customer side." },
  failedMessage: { fr: "Le forfait n'a pas pu être finalisé. Réessayez ou contactez AfriSendIQ si le statut reste bloqué.", en: "The bundle could not be finalized. Retry or contact AfriSendIQ if the status remains stuck." },
  readyTitle: { fr: "Forfait activé", en: "Bundle activated" },
  readyDescription: { fr: "Le forfait a été lancé côté opérateur. Le bénéficiaire peut vérifier sa connexion ou ses SMS de confirmation.", en: "The bundle has been launched on the operator side. The recipient can verify their data balance or confirmation SMS." },
  primaryLabel: { fr: "Statut", en: "Status" },
  primaryValue: { fr: "Activé sur le réseau", en: "Activated on network" },
  detailLabel: { fr: "Numéro servi", en: "Served number" },
  referenceLabel: { fr: "Référence de commande", en: "Order reference" },
  note: { fr: "Pour les forfaits data, la confirmation finale arrive souvent par SMS opérateur quelques instants après l'achat.", en: "For data bundles, final confirmation often arrives by operator SMS shortly after purchase." },
  copyReference: { fr: "Copier la référence", en: "Copy reference" },
  copiedReference: { fr: "Référence copiée.", en: "Reference copied." },
  shareWhatsapp: { fr: "Partager via WhatsApp", en: "Share via WhatsApp" },
  sendAnother: { fr: "Acheter un autre forfait", en: "Buy another bundle" }
};

function detectOperatorFromPhone(value: string): Operator | null {
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.startsWith("+22505") || cleaned.match(/^05/)) return "MTN";
  if (cleaned.startsWith("+22507") || cleaned.match(/^07/)) return "ORANGE";
  if (cleaned.startsWith("+22501") || cleaned.match(/^01/)) return "MOOV";
  return null;
}

function DataTopUpPageContent() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [products, setProducts] = useState<SoutraliProduct[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<Operator>("MTN");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [completedBundle, setCompletedBundle] = useState<CompletedDataState | null>(null);
  const [pendingBundle, setPendingBundle] = useState<PendingDataState | null>(null);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const { locale } = useCoteDIvoireLocale();

  const filteredProducts = products.filter((p) => p.brand === selectedOperator);
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const selectedAmount = selectedProduct?.amountOptions?.[0] ?? 0;
  const whatsappHref = completedBundle
    ? `https://wa.me/${completedBundle.recipientPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Forfait data envoyé. Référence Afrisendiq : ${completedBundle.reference}`)}`
    : null;

  useEffect(() => {
    try {
      const storedCompletion = window.localStorage.getItem(DATA_COMPLETION_STORAGE_KEY);
      if (!storedCompletion) {
        return;
      }

      const parsedCompletion = JSON.parse(storedCompletion) as CompletedDataState;
      if (!parsedCompletion?.reference || !parsedCompletion?.recipientPhone) {
        window.localStorage.removeItem(DATA_COMPLETION_STORAGE_KEY);
        return;
      }

      setCompletedBundle(parsedCompletion);
      setPhone(parsedCompletion.recipientPhone);
    } catch {
      window.localStorage.removeItem(DATA_COMPLETION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const storedPending = window.localStorage.getItem(DATA_PENDING_STORAGE_KEY);
      if (!storedPending) {
        return;
      }

      const parsedPending = JSON.parse(storedPending) as PendingDataState;
      if (!parsedPending?.orderId || !parsedPending?.customerStatus) {
        window.localStorage.removeItem(DATA_PENDING_STORAGE_KEY);
        return;
      }

      setPendingBundle(parsedPending);
      setPhone(parsedPending.recipientPhone || "");
    } catch {
      window.localStorage.removeItem(DATA_PENDING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!completedBundle) {
      window.localStorage.removeItem(DATA_COMPLETION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(DATA_COMPLETION_STORAGE_KEY, JSON.stringify(completedBundle));
  }, [completedBundle]);

  useEffect(() => {
    if (!pendingBundle) {
      window.localStorage.removeItem(DATA_PENDING_STORAGE_KEY);
      setPollAttemptCount(0);
      return;
    }

    window.localStorage.setItem(DATA_PENDING_STORAGE_KEY, JSON.stringify(pendingBundle));
  }, [pendingBundle]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/soutrali/products?category=data");
        const payload = await response.json();
        if (response.ok && payload.success) {
          setProducts(payload.products || []);
        }
      } catch {
        setProducts([]);
      }
    }
    void loadProducts();
  }, []);

  useEffect(() => {
    const first = filteredProducts[0];
    if (first) {
      setSelectedProductId(first.id);
    } else {
      setSelectedProductId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOperator, products.length]);

  function formatCustomerStatus(status: SoutraliTrackedCustomerStatus) {
    if (status === "payment_received") {
      return resolveLocalizedText(dataTopUpCopy.paymentReceivedStatus, locale);
    }

    if (status === "processing") {
      return resolveLocalizedText(dataTopUpCopy.processingStatus, locale);
    }

    if (status === "refunded") {
      return resolveLocalizedText(dataTopUpCopy.refundedStatus, locale);
    }

    if (status === "failed") {
      return resolveLocalizedText(dataTopUpCopy.failedStatus, locale);
    }

    return resolveLocalizedText(dataTopUpCopy.processingStatus, locale);
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
      dataAllowance: selectedProduct?.dataAllowance,
      validity: selectedProduct?.validity,
      completedAt: isSoutraliTrackedSuccessStatus(order.customerStatus) ? order.updatedAt : undefined,
    } satisfies PendingDataState;

    setPhone(order.customerReference);

    if (order.brand === "MTN" || order.brand === "ORANGE" || order.brand === "MOOV") {
      setSelectedOperator(order.brand);
    }

    if (order.productId) {
      setSelectedProductId(order.productId);
    }

    if (order.customerStatus === "completed") {
      setCompletedBundle({
        reference: order.reference || order.id,
        productName: order.productName,
        recipientPhone: order.customerReference,
        amount: order.amount,
        dataAllowance: nextPending.dataAllowance,
        validity: nextPending.validity,
        completedAt: order.updatedAt,
      });
      setPendingBundle(null);
      setPollAttemptCount(0);
      return;
    }

    setCompletedBundle(null);
    setPendingBundle(nextPending);
  }

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const paymentState = searchParams.get("payment");

    if (!orderId) {
      if (paymentState === "cancelled") {
        setStatusMessage(resolveLocalizedText(dataTopUpCopy.paymentCancelled, locale));
      }
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          throw new Error(payload.error || resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
        }

        applyTrackedOrder(payload.order);
        if (paymentState === "success") {
          setStatusMessage(resolveLocalizedText(dataTopUpCopy.processingStatus, locale));
        }
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
      }
    })();
  }, [locale, searchParams, selectedProduct?.dataAllowance, selectedProduct?.validity]);

  useEffect(() => {
    if (!pendingBundle || pendingBundle.customerStatus === "completed" || pendingBundle.customerStatus === "refunded" || pendingBundle.customerStatus === "failed") {
      return;
    }

    let cancelled = false;
    const pollingDelay = Math.min(
      SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS * Math.max(1, pollAttemptCount + 1),
      SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS
    );

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingBundle.orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          if (!cancelled) {
            setPollAttemptCount((current) => current + 1);
            if (response.status !== 429) {
              setStatusMessage(payload.error || resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
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
          setStatusMessage(resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
        }
      }
    }, pollingDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [locale, pendingBundle, pollAttemptCount, selectedProduct?.dataAllowance, selectedProduct?.validity]);

  const clearTrackedTransaction = () => {
    setPendingBundle(null);
    setCompletedBundle(null);
    setStatusMessage(null);
    setPollAttemptCount(0);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1a4a6b_0%,#0d1d26_42%,#080f14_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <AfriSendIQBrand className="max-w-xl" />
          <CoteDIvoireLanguageSwitch />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-blue-200/82">
              <span>{resolveLocalizedText(dataTopUpCopy.eyebrow, locale)}</span>
              <Link href="/cote-divoire" className="rounded-full border border-white/14 bg-white/8 px-3 py-1 text-[11px] text-white transition hover:bg-white/12">
                {resolveLocalizedText(dataTopUpCopy.backToHub, locale)}
              </Link>
            </div>

            <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">
              {resolveLocalizedText(dataTopUpCopy.title, locale)}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-50/78">
              {resolveLocalizedText(dataTopUpCopy.description, locale)}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-blue-200/70">{resolveLocalizedText(dataTopUpCopy.operator, locale)}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  {operators.map((op) => (
                    <button
                      key={op.key}
                      onClick={() => setSelectedOperator(op.key)}
                      className={`rounded-full px-3 py-1 transition ${
                        selectedOperator === op.key
                          ? `${op.bg} ${op.color} ring-2 ring-white/30`
                          : "bg-white/10 text-white/60 hover:bg-white/20"
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-blue-200/70">{resolveLocalizedText(dataTopUpCopy.countryCode, locale)}</div>
                <div className="mt-2 text-lg font-semibold">+225</div>
              </div>
              <div className="rounded-2xl bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-blue-200/70">{resolveLocalizedText(dataTopUpCopy.price, locale)}</div>
                <div className="mt-2 text-lg font-semibold">{selectedAmount > 0 ? `${selectedAmount.toLocaleString()} XOF` : "—"}</div>
              </div>
            </div>

            <div className="mt-6">
              <CoteDIvoireHeroPanel
                badge={resolveLocalizedText(dataTopUpCopy.eyebrow, locale)}
                gradientClass="from-[#1E40AF] via-[#3B82F6] to-[#60A5FA]"
                imageSrcs={coteDivoireVisualAssets.data}
                imageAlt={resolveLocalizedText(dataTopUpCopy.title, locale)}
                contextLabel="Soutrali · Côte d'Ivoire"
                heightClassName="min-h-[16rem]"
              />
            </div>
          </section>

          <section className="rounded-[2rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(3,12,9,0.18)]">
            {completedBundle ? (
              <SoutraliCodeReadyCard
                kind="data"
                locale={locale}
                title={resolveLocalizedText(dataTopUpCopy.readyTitle, locale)}
                description={resolveLocalizedText(dataTopUpCopy.readyDescription, locale)}
                primaryLabel={resolveLocalizedText(dataTopUpCopy.primaryLabel, locale)}
                primaryValue={resolveLocalizedText(dataTopUpCopy.primaryValue, locale)}
                productName={completedBundle.productName}
                amountLabel={`${completedBundle.amount.toLocaleString()} XOF`}
                logoSrc={selectedProduct?.serviceLogoPath}
                logoAlt="Soutrali data logo"
                recipientName={completedBundle.dataAllowance || completedBundle.recipientPhone}
                detailLabel={resolveLocalizedText(dataTopUpCopy.detailLabel, locale)}
                detailValue={completedBundle.recipientPhone}
                referenceLabel={resolveLocalizedText(dataTopUpCopy.referenceLabel, locale)}
                referenceValue={completedBundle.reference}
                note={resolveLocalizedText(dataTopUpCopy.note, locale)}
                completedAt={completedBundle.completedAt}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(completedBundle.reference);
                        setStatusMessage(resolveLocalizedText(dataTopUpCopy.copiedReference, locale));
                      }}
                      className="rounded-full bg-[#0E2E23] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#145440]"
                    >
                      {resolveLocalizedText(dataTopUpCopy.copyReference, locale)}
                    </button>
                    {whatsappHref ? (
                      <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                        {resolveLocalizedText(dataTopUpCopy.shareWhatsapp, locale)}
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
                    {resolveLocalizedText(dataTopUpCopy.sendAnother, locale)}
                  </button>
                }
              />
            ) : pendingBundle ? (
              <div className="rounded-[1.6rem] border border-blue-200 bg-blue-50 p-5 text-[#163a75]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">{resolveLocalizedText(dataTopUpCopy.pendingTitle, locale)}</div>
                    <p className="mt-1 text-sm leading-6 text-blue-900">{resolveLocalizedText(dataTopUpCopy.pendingDescription, locale)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-white/90 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{resolveLocalizedText(dataTopUpCopy.pendingReference, locale)}</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{pendingBundle.reference || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AfriSendIQ</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{resolveLocalizedText(dataTopUpCopy.pendingStatus, locale).replace("{status}", formatCustomerStatus(pendingBundle.customerStatus))}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-blue-900">
                  {pendingBundle.customerStatus === "refunded"
                    ? resolveLocalizedText(dataTopUpCopy.refundedMessage, locale)
                    : pendingBundle.customerStatus === "failed"
                      ? resolveLocalizedText(dataTopUpCopy.failedMessage, locale)
                      : resolveLocalizedText(dataTopUpCopy.pendingPolling, locale)}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setPollAttemptCount(0);
                      try {
                        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingBundle.orderId)}`);
                        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;
                        if (response.ok && payload.success && payload.order) {
                          applyTrackedOrder(payload.order);
                        } else {
                          setStatusMessage(payload.error || resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
                        }
                      } catch {
                        setStatusMessage(resolveLocalizedText(dataTopUpCopy.statusLookupFailed, locale));
                      }
                    }}
                    className="rounded-full border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
                  >
                    {resolveLocalizedText(dataTopUpCopy.refreshStatus, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={clearTrackedTransaction}
                    className="rounded-full border border-blue-200 bg-blue-100/70 px-4 py-2 text-sm font-semibold text-blue-950 transition hover:bg-blue-200"
                  >
                    {resolveLocalizedText(dataTopUpCopy.clearTrackedTransaction, locale)}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold">{resolveLocalizedText(dataTopUpCopy.phoneNumber, locale)}</label>
                <input
                  type="text"
                  placeholder="+2250708123456"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPhone(value);
                    setStatusMessage(null);
                    const detected = detectOperatorFromPhone(value);
                    if (detected) {
                      setSelectedOperator(detected);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />

                <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(dataTopUpCopy.selectBundle, locale)}</label>
                {filteredProducts.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">{resolveLocalizedText(dataTopUpCopy.noBundle, locale)}</p>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">{resolveLocalizedText(dataTopUpCopy.chooseBundle, locale)}</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.dataAllowance} — {product.validity} — {product.amountOptions[0]?.toLocaleString()} XOF
                      </option>
                    ))}
                  </select>
                )}

                {selectedProduct && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <CoteDIvoireServiceLogo
                      src={selectedProduct.serviceLogoPath}
                      alt={`${selectedProduct.name} logo`}
                      className="h-12 w-12 rounded-xl border-blue-100 p-1.5"
                    />
                    <div>
                      <div className="font-semibold">{resolveLocalizedText(dataTopUpCopy.selectedBundle, locale)}</div>
                      <div className="mt-1">{selectedProduct.name}</div>
                      <div className="mt-1 font-semibold">{selectedAmount.toLocaleString()} XOF</div>
                    </div>
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
                      setStatusMessage(resolveLocalizedText(dataTopUpCopy.enterPhone, locale));
                      return;
                    }
                    if (!selectedProductId) {
                      setStatusMessage(resolveLocalizedText(dataTopUpCopy.selectBeforeContinue, locale));
                      return;
                    }

                    setSubmitting(true);
                    setStatusMessage(resolveLocalizedText(dataTopUpCopy.routing, locale));

                    try {
                      const res = await fetch("/api/soutrali/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          productId: selectedProductId,
                          customerReference: phone,
                          recipientLabel: phone,
                          amount: selectedAmount
                        })
                      });

                      const data = (await res.json()) as SoutraliTrackedCheckoutResponse;

                      if (data.success && data.orderId && data.checkoutUrl) {
                        setPendingBundle({
                          orderId: data.orderId,
                          customerStatus: "awaiting_payment",
                          reference: null,
                          quotedPrice: data.quotedPrice,
                          productName: selectedProduct?.name || "Soutrali data bundle",
                          recipientPhone: phone,
                          amount: selectedAmount,
                          dataAllowance: selectedProduct?.dataAllowance,
                          validity: selectedProduct?.validity,
                        });
                        setCompletedBundle(null);
                        setStatusMessage(resolveLocalizedText(dataTopUpCopy.redirectingToPayment, locale));
                        window.location.assign(data.checkoutUrl);
                        return;
                      }

                      if (!data.success) {
                        setStatusMessage(data.error || resolveLocalizedText(dataTopUpCopy.rechargeFailed, locale));
                      } else {
                        setStatusMessage(resolveLocalizedText(dataTopUpCopy.endpointFailed, locale));
                      }
                    } catch {
                      setStatusMessage(resolveLocalizedText(dataTopUpCopy.endpointFailed, locale));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting}
                  className="mt-6 w-full rounded-xl bg-[#1E40AF] px-4 py-3 font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#4B5E8A]"
                >
                  {submitting ? resolveLocalizedText(dataTopUpCopy.submitting, locale) : resolveLocalizedText(dataTopUpCopy.continue, locale)}
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function DataTopUpPage() {
  return (
    <Suspense fallback={null}>
      <DataTopUpPageContent />
    </Suspense>
  );
}
