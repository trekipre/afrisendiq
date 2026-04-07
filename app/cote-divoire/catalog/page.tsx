"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireSectionHeading } from "@/app/components/CoteDIvoireSectionHeading";
import { CoteDIvoireHeroPanel } from "@/app/components/CoteDIvoireHeroPanel";
import { CoteDIvoireServiceLogo } from "@/app/components/CoteDIvoireServiceLogo";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { SoutraliCodeReadyCard } from "@/app/components/SoutraliCodeReadyCard";
import { resolveLocalizedText, useCoteDIvoireLocale } from "@/app/components/CoteDIvoireLocale";
import { type CompletedCatalogCheckout } from "@/app/lib/catalogCheckoutSuccess";
import { coteDivoireVisualAssets } from "@/app/lib/coteDivoireVisualAssets";
import {
  SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS,
  SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS,
  type SoutraliTrackedCheckoutResponse,
  type SoutraliTrackedCustomerStatus,
  type SoutraliTrackedOrderCustomerView,
  type SoutraliTrackedOrderLookupResponse,
} from "@/app/lib/soutraliTrackedClient";

type CompletionKind = "airtime" | "data" | "electricity" | "gift-card";

type SoutraliProduct = {
  id: string;
  name: string;
  description: string;
  brand?: string;
  category: CompletionKind;
  currency: string;
  amountOptions: number[];
  minAmount: number;
  maxAmount: number;
  recipientLabel: string;
  customerReferenceLabel: string;
  serviceLogoPath?: string;
};

type PendingCatalogCheckoutState = CompletedCatalogCheckout & {
  orderId: string;
  productId: string;
  customerStatus: SoutraliTrackedCustomerStatus;
  quotedPrice?: number;
};

const MANUAL_CANAL_PLUS_OPTION_ID = "manual-canal-plus";
const CATALOG_COMPLETION_STORAGE_KEY = "afrisendiq-ci-catalog-completion";
const CATALOG_PENDING_STORAGE_KEY = "afrisendiq-ci-catalog-pending-order";

const catalogCopy = {
  backToHub: { fr: "Retour", en: "Back" },
  openTopUp: { fr: "RECHARGE MOBILE", en: "Phone Top-Up" },
  eyebrow: { fr: "CATALOGUE", en: "Catalog" },
  title: { fr: "PRODUITS DISPONIBLES EN CÔTE D'IVOIRE", en: "Available products in Côte d'Ivoire" },
  description: {
    fr: "Parcourez les produits automatisés disponibles pour la Côte d'Ivoire : unités, forfaits data et cartes cadeaux Jumia.",
    en: "Browse the automated Côte d'Ivoire products: airtime, data bundles, and Jumia gift cards."
  },
  purchaseDescription: {
    fr: "Choisissez un produit automatisé et passez au paiement depuis le même parcours Soutrali. Pour CIE, SODECI et Canal+, utilisez les pages manuelles dédiées.",
    en: "Choose an automated product and move into payment from the same Soutrali flow. For CIE, SODECI, and Canal+, use the dedicated manual pages."
  },
  overview: { fr: "Aperçu", en: "Overview" },
  products: { fr: "Produits", en: "Products" },
  loading: { fr: "Chargement...", en: "Loading..." },
  productsAvailable: { fr: "produits disponibles", en: "products available" },
  brands: { fr: "Marques", en: "Brands" },
  purchase: { fr: "Achat", en: "Purchase" },
  product: { fr: "Produit", en: "Product" },
  chooseProduct: { fr: "Choisissez un produit", en: "Choose a product" },
  customerReference: { fr: "Référence client", en: "Customer reference" },
  recipient: { fr: "Destinataire", en: "Recipient" },
  amount: { fr: "Montant", en: "Amount" },
  processing: { fr: "Préparation du paiement sécurisé...", en: "Preparing secure payment..." },
  redirectingToPayment: { fr: "Redirection vers Stripe pour finaliser le paiement...", en: "Redirecting to Stripe to complete payment..." },
  paymentCancelled: { fr: "Le paiement a été annulé avant confirmation. Vous pouvez réessayer.", en: "Payment was cancelled before confirmation. You can try again." },
  purchaseFailed: { fr: "L'achat a échoué. Veuillez réessayer.", en: "Purchase failed. Please try again." },
  submitting: { fr: "Envoi...", en: "Sending..." },
  confirm: { fr: "Confirmer l'achat", en: "Confirm purchase" },
  loadingProducts: { fr: "Chargement des produits...", en: "Loading products..." },
  active: { fr: "Actif", en: "Active" },
  pendingTitle: { fr: "Commande en cours de traitement", en: "Order being processed" },
  pendingDescription: { fr: "Le paiement est reçu ou en cours de confirmation. AfriSendIQ finalise maintenant votre produit auprès du fournisseur.", en: "The payment has been received or is being confirmed. AfriSendIQ is now finalizing your product with the provider." },
  pendingReference: { fr: "Référence AfriSendIQ", en: "AfriSendIQ reference" },
  pendingStatus: { fr: "Statut AfriSendIQ : {status}", en: "AfriSendIQ status: {status}" },
  pendingPolling: { fr: "Le suivi se met à jour automatiquement jusqu'à la finalisation ou au remboursement.", en: "Tracking refreshes automatically until completion or refund." },
  paymentReceivedStatus: { fr: "Paiement confirmé", en: "Payment confirmed" },
  processingStatus: { fr: "Traitement fournisseur en cours", en: "Provider processing in progress" },
  refundedStatus: { fr: "Paiement remboursé", en: "Payment refunded" },
  failedStatus: { fr: "Traitement interrompu", en: "Processing interrupted" },
  refreshStatus: { fr: "Actualiser le statut", en: "Refresh status" },
  clearTrackedTransaction: { fr: "Effacer le suivi", en: "Clear tracked transaction" },
  statusLookupFailed: { fr: "Impossible de récupérer le suivi pour le moment. Réessayez dans quelques instants.", en: "Unable to retrieve tracking right now. Try again shortly." },
  refundedMessage: { fr: "Le paiement a été remboursé automatiquement. Aucun débit fournisseur définitif n'a été conservé côté client.", en: "The payment was refunded automatically. No final provider charge was kept on the customer side." },
  failedMessage: { fr: "La commande n'a pas pu être finalisée. Réessayez ou contactez AfriSendIQ si le statut reste bloqué.", en: "The order could not be finalized. Retry or contact AfriSendIQ if the status remains stuck." },
  copiedPrimary: { fr: "Information copiée.", en: "Details copied." },
  copyPrimary: { fr: "Copier", en: "Copy" },
  shareWhatsapp: { fr: "Partager via WhatsApp", en: "Share via WhatsApp" },
  shareEmail: { fr: "Partager par email", en: "Share by email" },
  buyAnother: { fr: "Acheter un autre produit", en: "Buy another product" }
};

function getCatalogCompletionPresentation(completion: CompletedCatalogCheckout, locale: "fr" | "en") {
  const isFrench = locale === "fr";
  const recipientName = completion.usesSharedContactField
    ? completion.customerReference
    : completion.recipientValue || completion.customerReference;
  const recipientContact = completion.kind === "gift-card" && !completion.usesSharedContactField
    ? completion.customerReference
    : undefined;

  switch (completion.kind) {
    case "electricity":
      return {
        title: isFrench ? "Code CIE prêt" : "CIE code ready",
        description: isFrench ? "Le code de recharge CIE est prêt. Vous pouvez le partager immédiatement avec votre proche." : "The CIE top-up code is ready. You can share it with your recipient immediately.",
        primaryLabel: isFrench ? "Code CIE" : "CIE code",
        primaryValue: completion.rechargeCode || completion.reference,
        detailLabel: completion.recipientLabel,
        detailValue: completion.recipientValue || completion.customerReference,
        referenceLabel: isFrench ? "Référence de commande" : "Order reference",
        note: isFrench ? "Le bénéficiaire peut saisir ce code sur son compteur ou auprès du canal CIE approprié." : "The recipient can enter this code on their meter or through the appropriate CIE channel.",
        recipientName,
        recipientContact,
      };
    case "gift-card":
      return {
        title: isFrench ? "Code prêt à être partagé" : "Code ready to be shared",
        description: isFrench ? "Le bon d'achat est prêt. Vous pouvez le partager immédiatement avec votre proche." : "The voucher is ready. You can share it with your recipient immediately.",
        primaryLabel: isFrench ? "Code cadeau" : "Gift code",
        primaryValue: completion.rechargeCode || completion.reference,
        detailLabel: isFrench ? "Canal du bénéficiaire" : "Recipient channel",
        detailValue: completion.customerReference,
        referenceLabel: isFrench ? "Référence de commande" : "Order reference",
        note: isFrench ? "Le bénéficiaire pourra utiliser ce code lors du paiement chez le marchand partenaire." : "The recipient can use this code at checkout with the partner merchant.",
        recipientName,
        recipientContact,
      };
    case "data":
      return {
        title: isFrench ? "Forfait activé" : "Bundle activated",
        description: isFrench ? "Le forfait a été lancé côté opérateur. Le bénéficiaire peut vérifier ses SMS ou son solde data." : "The bundle has been launched on the operator side. The recipient can check SMS confirmation or their data balance.",
        primaryLabel: isFrench ? "Statut" : "Status",
        primaryValue: isFrench ? "Activé sur le réseau" : "Activated on network",
        detailLabel: completion.recipientLabel,
        detailValue: completion.customerReference,
        referenceLabel: isFrench ? "Référence de commande" : "Order reference",
        note: isFrench ? "La confirmation finale peut arriver quelques instants plus tard par SMS opérateur." : "Final confirmation may arrive shortly afterward by operator SMS.",
        recipientName: completion.productName,
        recipientContact: completion.customerReference,
      };
    case "airtime":
    default:
      return {
        title: isFrench ? "Recharge livrée" : "Top-up delivered",
        description: isFrench ? "Les unités sont parties. Vous pouvez confirmer la réception avec votre proche." : "The units have been sent. You can confirm delivery with your recipient.",
        primaryLabel: isFrench ? "Statut" : "Status",
        primaryValue: isFrench ? "Livré au réseau" : "Delivered to network",
        detailLabel: completion.recipientLabel,
        detailValue: completion.customerReference,
        referenceLabel: isFrench ? "Référence de commande" : "Order reference",
        note: isFrench ? "Demandez au bénéficiaire de vérifier son solde ou les unités reçues." : "Ask the recipient to check their balance or received units.",
        recipientName,
        recipientContact,
      };
  }
}

function CoteDIvoireCatalogPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<SoutraliProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [recipientValue, setRecipientValue] = useState("");
  const [amount, setAmount] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [completedCheckout, setCompletedCheckout] = useState<CompletedCatalogCheckout | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingCatalogCheckoutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pollAttemptCount, setPollAttemptCount] = useState(0);
  const { locale } = useCoteDIvoireLocale();

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch("/api/soutrali/products");
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || resolveLocalizedText(catalogCopy.purchaseFailed, locale));
        }

        const nextProducts = Array.isArray(payload.products) ? payload.products : [];
        setProducts(nextProducts);
        setSelectedProductId((current) => current || nextProducts[0]?.id || "");
        setAmount((current) => current || (nextProducts[0]?.amountOptions?.[0] ? String(nextProducts[0].amountOptions[0]) : ""));
      } catch (error) {
        setProducts([]);
        setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(catalogCopy.purchaseFailed, locale));
      } finally {
        setLoading(false);
      }
    }

    void loadCatalog();
  }, [locale]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const usesSharedContactField = Boolean(
    selectedProduct && selectedProduct.customerReferenceLabel === selectedProduct.recipientLabel
  );
  const effectiveRecipientValue = usesSharedContactField ? customerReference : recipientValue;
  const completionPresentation = completedCheckout
    ? getCatalogCompletionPresentation(completedCheckout, locale)
    : null;
  const shareTarget = completedCheckout?.customerReference || "";
  const normalizedWhatsappTarget = shareTarget.replace(/\D/g, "");
  const primaryShareValue = completedCheckout?.rechargeCode || completedCheckout?.reference || "";
  const whatsappHref = normalizedWhatsappTarget && primaryShareValue
    ? `https://wa.me/${normalizedWhatsappTarget}?text=${encodeURIComponent(`AfriSendIQ: ${primaryShareValue}`)}`
    : null;
  const emailHref = shareTarget.includes("@") && primaryShareValue
    ? `mailto:${encodeURIComponent(shareTarget)}?subject=${encodeURIComponent("AfriSendIQ Côte d'Ivoire")}&body=${encodeURIComponent(`Bonjour,\n\nVoici votre information Afrisendiq : ${primaryShareValue}\nRéférence : ${completedCheckout?.reference || ""}`)}`
    : null;

  useEffect(() => {
    try {
      const storedCompletion = window.localStorage.getItem(CATALOG_COMPLETION_STORAGE_KEY);
      if (!storedCompletion) {
        return;
      }

      const parsedCompletion = JSON.parse(storedCompletion) as CompletedCatalogCheckout;
      if (!parsedCompletion?.reference || !parsedCompletion?.kind) {
        window.localStorage.removeItem(CATALOG_COMPLETION_STORAGE_KEY);
        return;
      }

      setCompletedCheckout(parsedCompletion);
      setCustomerReference(parsedCompletion.customerReference || "");
      setRecipientValue(parsedCompletion.usesSharedContactField ? "" : parsedCompletion.recipientValue || "");
      setAmount(parsedCompletion.amount ? String(parsedCompletion.amount) : "");
    } catch {
      window.localStorage.removeItem(CATALOG_COMPLETION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      const storedPending = window.localStorage.getItem(CATALOG_PENDING_STORAGE_KEY);
      if (!storedPending) {
        return;
      }

      const parsedPending = JSON.parse(storedPending) as PendingCatalogCheckoutState;
      if (!parsedPending?.orderId || !parsedPending?.customerStatus) {
        window.localStorage.removeItem(CATALOG_PENDING_STORAGE_KEY);
        return;
      }

      setPendingCheckout(parsedPending);
      setSelectedProductId(parsedPending.productId || "");
      setCustomerReference(parsedPending.customerReference || "");
      setRecipientValue(parsedPending.usesSharedContactField ? "" : parsedPending.recipientValue || "");
      setAmount(parsedPending.amount ? String(parsedPending.amount) : "");
    } catch {
      window.localStorage.removeItem(CATALOG_PENDING_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!completedCheckout) {
      window.localStorage.removeItem(CATALOG_COMPLETION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CATALOG_COMPLETION_STORAGE_KEY, JSON.stringify(completedCheckout));
  }, [completedCheckout]);

  useEffect(() => {
    if (!pendingCheckout) {
      window.localStorage.removeItem(CATALOG_PENDING_STORAGE_KEY);
      setPollAttemptCount(0);
      return;
    }

    window.localStorage.setItem(CATALOG_PENDING_STORAGE_KEY, JSON.stringify(pendingCheckout));
  }, [pendingCheckout]);

  const uniqueBrandProducts = useMemo(() => {
    const seenBrands = new Set<string>();

    return products.filter((product) => {
      if (!product.brand || seenBrands.has(product.brand)) {
        return false;
      }

      seenBrands.add(product.brand);
      return true;
    });
  }, [products]);
  const brandTiles = useMemo(() => {
    const hasCanalPlus = uniqueBrandProducts.some((product) => product.brand === "CANAL+");

    if (hasCanalPlus) {
      return uniqueBrandProducts;
    }

    return [
      ...uniqueBrandProducts,
      {
        id: "manual-canal-plus",
        name: "CANAL+",
        brand: "CANAL+",
        serviceLogoPath: coteDivoireVisualAssets.canalPlus[0]
      } satisfies Pick<SoutraliProduct, "id" | "name" | "brand" | "serviceLogoPath">
    ];
  }, [uniqueBrandProducts]);

  useEffect(() => {
    if (!selectedProduct || pendingCheckout || completedCheckout) {
      return;
    }

    setAmount(selectedProduct.amountOptions[0] ? String(selectedProduct.amountOptions[0]) : "");
  }, [completedCheckout, pendingCheckout, selectedProduct]);

  function formatCustomerStatus(status: SoutraliTrackedCustomerStatus) {
    if (status === "payment_received") {
      return resolveLocalizedText(catalogCopy.paymentReceivedStatus, locale);
    }

    if (status === "processing") {
      return resolveLocalizedText(catalogCopy.processingStatus, locale);
    }

    if (status === "refunded") {
      return resolveLocalizedText(catalogCopy.refundedStatus, locale);
    }

    if (status === "failed") {
      return resolveLocalizedText(catalogCopy.failedStatus, locale);
    }

    return resolveLocalizedText(catalogCopy.processingStatus, locale);
  }

  function applyTrackedOrder(order: SoutraliTrackedOrderCustomerView) {
    const matchedProduct = products.find((product) => product.id === order.productId);
    const usesSharedField = matchedProduct
      ? matchedProduct.customerReferenceLabel === matchedProduct.recipientLabel
      : order.recipientLabel === order.customerReference;

    const completion = {
      kind: order.category,
      reference: order.reference || order.id,
      productName: order.productName,
      amount: order.amount,
      currency: order.currency,
      customerReference: order.customerReference,
      customerReferenceLabel: matchedProduct?.customerReferenceLabel || resolveLocalizedText(catalogCopy.customerReference, locale),
      recipientValue: usesSharedField ? order.customerReference : order.recipientLabel,
      recipientLabel: matchedProduct?.recipientLabel || resolveLocalizedText(catalogCopy.recipient, locale),
      usesSharedContactField: usesSharedField,
      rechargeCode: order.rechargeCode || undefined,
      completedAt: (order.customerStatus === "completed" || order.customerStatus === "code_ready") ? order.updatedAt : undefined,
      logoSrc: matchedProduct?.serviceLogoPath,
    } satisfies CompletedCatalogCheckout;

    setSelectedProductId(order.productId);
    setCustomerReference(order.customerReference);
    setRecipientValue(usesSharedField ? "" : order.recipientLabel);
    setAmount(String(order.amount));

    if (order.customerStatus === "completed" || order.customerStatus === "code_ready") {
      setCompletedCheckout(completion);
      setPendingCheckout(null);
      setPollAttemptCount(0);
      return;
    }

    setCompletedCheckout(null);
    setPendingCheckout({
      orderId: order.id,
      productId: order.productId,
      customerStatus: order.customerStatus,
      quotedPrice: order.quotedPrice,
      ...completion,
    });
  }

  const clearTrackedCheckout = () => {
    setPendingCheckout(null);
    setCompletedCheckout(null);
    setStatusMessage(null);
    setPollAttemptCount(0);
  };

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    const paymentState = searchParams.get("payment");

    if (!orderId) {
      if (paymentState === "cancelled") {
        setStatusMessage(resolveLocalizedText(catalogCopy.paymentCancelled, locale));
      }
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          throw new Error(payload.error || resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
        }

        applyTrackedOrder(payload.order);
        if (paymentState === "success") {
          setStatusMessage(resolveLocalizedText(catalogCopy.processingStatus, locale));
        }
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
      }
    })();
  }, [locale, products, searchParams]);

  useEffect(() => {
    if (!pendingCheckout || pendingCheckout.customerStatus === "completed" || pendingCheckout.customerStatus === "code_ready" || pendingCheckout.customerStatus === "refunded" || pendingCheckout.customerStatus === "failed") {
      return;
    }

    let cancelled = false;
    const pollingDelay = Math.min(
      SOUTRALI_TRACKED_POLLING_BASE_DELAY_MS * Math.max(1, pollAttemptCount + 1),
      SOUTRALI_TRACKED_POLLING_MAX_DELAY_MS
    );

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingCheckout.orderId)}`);
        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;

        if (!response.ok || !payload.success || !payload.order) {
          if (!cancelled) {
            setPollAttemptCount((current) => current + 1);
            if (response.status !== 429) {
              setStatusMessage(payload.error || resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
            }
          }
          return;
        }

        if (!cancelled) {
          if (payload.order.customerStatus === "completed" || payload.order.customerStatus === "code_ready") {
            setPollAttemptCount(0);
          } else {
            setPollAttemptCount((current) => current + 1);
          }
          applyTrackedOrder(payload.order);
        }
      } catch {
        if (!cancelled) {
          setPollAttemptCount((current) => current + 1);
          setStatusMessage(resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
        }
      }
    }, pollingDelay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [locale, pendingCheckout, pollAttemptCount, products]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#164632_0%,#0c2118_42%,#08140f_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="flex flex-wrap gap-3 text-sm">
            <CoteDIvoireLanguageSwitch />
            <Link href="/cote-divoire" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              {resolveLocalizedText(catalogCopy.backToHub, locale)}
            </Link>
            <Link href="/cote-divoire/phone-top-up" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              {resolveLocalizedText(catalogCopy.openTopUp, locale)}
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.2)] backdrop-blur">
            <CoteDIvoireSectionHeading
              locale={locale}
              eyebrow={catalogCopy.eyebrow}
              title={catalogCopy.title}
              description={catalogCopy.description}
            />
          </section>

          <section className="rounded-[2rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(3,12,9,0.18)]">
            <CoteDIvoireHeroPanel
              badge={resolveLocalizedText(catalogCopy.eyebrow, locale)}
              gradientClass="from-[#065F46] via-[#059669] to-[#34D399]"
              imageSrcs={coteDivoireVisualAssets.catalog}
              imageAlt={resolveLocalizedText(catalogCopy.title, locale)}
              contextLabel="Soutrali · Côte d'Ivoire"
              heightClassName="min-h-[16rem]"
            />

            <div className="mt-6">
              <CoteDIvoireSectionHeading
                locale={locale}
                eyebrow={{ fr: "Soutrali overview", en: "Soutrali overview" }}
                title={catalogCopy.overview}
              />
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl bg-[#F5FBF8] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{resolveLocalizedText(catalogCopy.products, locale)}</div>
                <div className="mt-2 text-lg font-semibold">{loading ? resolveLocalizedText(catalogCopy.loading, locale) : `${products.length} ${resolveLocalizedText(catalogCopy.productsAvailable, locale)}`}</div>
              </div>
              <div className="rounded-2xl bg-[#F5FBF8] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{resolveLocalizedText(catalogCopy.brands, locale)}</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {brandTiles.map((product) => (
                    <div key={product.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm">
                      <CoteDIvoireServiceLogo
                        src={product.serviceLogoPath}
                        alt={`${product.brand || product.name} logo`}
                        className="h-12 w-12 rounded-xl border-0 p-1 shadow-none"
                      />
                      {product.brand ? <span className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{product.brand}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
            <CoteDIvoireSectionHeading
              locale={locale}
              eyebrow={{ fr: "Soutrali workflow", en: "Soutrali workflow" }}
              title={catalogCopy.purchase}
              description={catalogCopy.purchaseDescription}
            />

            <label className="mt-4 block text-sm font-semibold">{resolveLocalizedText(catalogCopy.product, locale)}</label>
            <select
              value={selectedProductId}
              onChange={(event) => {
                const nextValue = event.target.value;

                if (nextValue === MANUAL_CANAL_PLUS_OPTION_ID) {
                  router.push("/cote-divoire/canal-plus");
                  return;
                }

                setSelectedProductId(nextValue);
                clearTrackedCheckout();
              }}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            >
              <option value="">{resolveLocalizedText(catalogCopy.chooseProduct, locale)}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
              <option value={MANUAL_CANAL_PLUS_OPTION_ID}>Soutrali CANAL+</option>
            </select>

            <label className="mt-5 block text-sm font-semibold">{selectedProduct?.customerReferenceLabel || resolveLocalizedText(catalogCopy.customerReference, locale)}</label>
            <input
              value={customerReference}
              onChange={(event) => setCustomerReference(event.target.value)}
              placeholder={selectedProduct?.customerReferenceLabel || resolveLocalizedText(catalogCopy.customerReference, locale)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            />

            {!usesSharedContactField ? (
              <>
                <label className="mt-5 block text-sm font-semibold">{selectedProduct?.recipientLabel || resolveLocalizedText(catalogCopy.recipient, locale)}</label>
                <input
                  value={recipientValue}
                  onChange={(event) => setRecipientValue(event.target.value)}
                  placeholder={selectedProduct?.recipientLabel || resolveLocalizedText(catalogCopy.recipient, locale)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />
              </>
            ) : null}

            <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(catalogCopy.amount, locale)} {selectedProduct?.currency ? `(${selectedProduct.currency})` : ""}</label>
            <select
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
            >
              <option value="">Choose an amount</option>
              {(selectedProduct?.amountOptions || []).map((option) => (
                <option key={option} value={String(option)}>
                  {option.toLocaleString()} {selectedProduct?.currency}
                </option>
              ))}
            </select>

            {statusMessage && (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{statusMessage}</div>
            )}

            <button
              disabled={!selectedProductId || !amount || !customerReference.trim() || !effectiveRecipientValue.trim() || submitting}
              onClick={async () => {
                setSubmitting(true);
                setStatusMessage(resolveLocalizedText(catalogCopy.processing, locale));

                try {
                  if (!selectedProduct) {
                    throw new Error(resolveLocalizedText(catalogCopy.purchaseFailed, locale));
                  }

                  const response = await fetch("/api/soutrali/checkout", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      productId: selectedProductId,
                      customerReference,
                      recipientLabel: effectiveRecipientValue,
                      amount: Number(amount)
                    })
                  });

                  const payload = (await response.json()) as SoutraliTrackedCheckoutResponse;

                  if (!response.ok || !payload.success || !payload.orderId || !payload.checkoutUrl) {
                    throw new Error(payload.error || resolveLocalizedText(catalogCopy.purchaseFailed, locale));
                  }

                  setPendingCheckout({
                    orderId: payload.orderId,
                    productId: selectedProduct.id,
                    customerStatus: "awaiting_payment",
                    quotedPrice: payload.quotedPrice,
                    kind: selectedProduct.category,
                    reference: payload.orderId,
                    productName: selectedProduct.name,
                    amount: Number(amount),
                    currency: selectedProduct.currency,
                    customerReference,
                    customerReferenceLabel: selectedProduct.customerReferenceLabel,
                    recipientValue: effectiveRecipientValue,
                    recipientLabel: selectedProduct.recipientLabel,
                    usesSharedContactField,
                    logoSrc: selectedProduct.serviceLogoPath,
                  });
                  setCompletedCheckout(null);
                  setStatusMessage(resolveLocalizedText(catalogCopy.redirectingToPayment, locale));
                  window.location.assign(payload.checkoutUrl);
                  return;
                } catch (error) {
                  setStatusMessage(error instanceof Error ? error.message : resolveLocalizedText(catalogCopy.purchaseFailed, locale));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-6 w-full rounded-xl bg-[#0F3D2E] px-4 py-3 font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:bg-[#4d6a5f]"
            >
              {submitting ? resolveLocalizedText(catalogCopy.submitting, locale) : resolveLocalizedText(catalogCopy.confirm, locale)}
            </button>
          </div>

          <div>
            {loading ? (
              <div className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">
                {resolveLocalizedText(catalogCopy.loadingProducts, locale)}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
                {products.map((product) => (
                  <article key={product.id} className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{product.category}</div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
                          {resolveLocalizedText(catalogCopy.active, locale)}
                        </div>
                        <CoteDIvoireServiceLogo
                          src={product.serviceLogoPath}
                          alt={`${product.name} logo`}
                          className="h-12 w-12 rounded-xl border-slate-200 p-1.5"
                        />
                      </div>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold leading-tight">{product.name}</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                      {product.brand ? <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">{product.brand}</span> : null}
                      <span className="rounded-full bg-slate-100 px-3 py-1">{product.minAmount} - {product.maxAmount} {product.currency}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {completedCheckout && completionPresentation ? (
              <div className="mt-6">
                <SoutraliCodeReadyCard
                  kind={completedCheckout.kind}
                  locale={locale}
                  title={completionPresentation.title}
                  description={completionPresentation.description}
                  primaryLabel={completionPresentation.primaryLabel}
                  primaryValue={completionPresentation.primaryValue}
                  productName={completedCheckout.productName}
                  amountLabel={`${completedCheckout.amount.toLocaleString()} ${completedCheckout.currency}`}
                  logoSrc={completedCheckout.logoSrc}
                  logoAlt={`${completedCheckout.productName} logo`}
                  recipientName={completionPresentation.recipientName}
                  recipientContact={completionPresentation.recipientContact}
                  detailLabel={completionPresentation.detailLabel}
                  detailValue={completionPresentation.detailValue}
                  referenceLabel={completionPresentation.referenceLabel}
                  referenceValue={completedCheckout.reference}
                  note={completionPresentation.note}
                  completedAt={completedCheckout.completedAt}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(primaryShareValue);
                          setStatusMessage(resolveLocalizedText(catalogCopy.copiedPrimary, locale));
                        }}
                        className="rounded-full bg-[#0E2E23] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#145440]"
                      >
                        {resolveLocalizedText(catalogCopy.copyPrimary, locale)}
                      </button>
                      {whatsappHref ? (
                        <a href={whatsappHref} target="_blank" rel="noreferrer" className="rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-[#073b1f] transition hover:bg-[#20bd59]">
                          {resolveLocalizedText(catalogCopy.shareWhatsapp, locale)}
                        </a>
                      ) : null}
                      {emailHref ? (
                        <a href={emailHref} className="rounded-full border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50">
                          {resolveLocalizedText(catalogCopy.shareEmail, locale)}
                        </a>
                      ) : null}
                    </>
                  }
                  footerAction={
                    <button
                      type="button"
                      onClick={clearTrackedCheckout}
                      className="w-full rounded-[1.3rem] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                    >
                      {resolveLocalizedText(catalogCopy.buyAnother, locale)}
                    </button>
                  }
                />
              </div>
            ) : pendingCheckout ? (
              <div className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 text-[#14532d] shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{resolveLocalizedText(catalogCopy.pendingTitle, locale)}</div>
                    <p className="mt-1 text-sm leading-6 text-emerald-900">{resolveLocalizedText(catalogCopy.pendingDescription, locale)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-white/90 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{resolveLocalizedText(catalogCopy.pendingReference, locale)}</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{pendingCheckout.reference || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">AfriSendIQ</div>
                    <div className="mt-1 font-semibold text-[#0E2E23]">{resolveLocalizedText(catalogCopy.pendingStatus, locale).replace("{status}", formatCustomerStatus(pendingCheckout.customerStatus))}</div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-emerald-900">
                  {pendingCheckout.customerStatus === "refunded"
                    ? resolveLocalizedText(catalogCopy.refundedMessage, locale)
                    : pendingCheckout.customerStatus === "failed"
                      ? resolveLocalizedText(catalogCopy.failedMessage, locale)
                      : resolveLocalizedText(catalogCopy.pendingPolling, locale)}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setPollAttemptCount(0);
                      try {
                        const response = await fetch(`/api/soutrali/order?orderId=${encodeURIComponent(pendingCheckout.orderId)}`);
                        const payload = (await response.json()) as SoutraliTrackedOrderLookupResponse;
                        if (response.ok && payload.success && payload.order) {
                          applyTrackedOrder(payload.order);
                        } else {
                          setStatusMessage(payload.error || resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
                        }
                      } catch {
                        setStatusMessage(resolveLocalizedText(catalogCopy.statusLookupFailed, locale));
                      }
                    }}
                    className="rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    {resolveLocalizedText(catalogCopy.refreshStatus, locale)}
                  </button>
                  <button
                    type="button"
                    onClick={clearTrackedCheckout}
                    className="rounded-full border border-emerald-200 bg-emerald-100/70 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
                  >
                    {resolveLocalizedText(catalogCopy.clearTrackedTransaction, locale)}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CoteDIvoireCatalogPage() {
  return (
    <Suspense fallback={null}>
      <CoteDIvoireCatalogPageContent />
    </Suspense>
  );
}