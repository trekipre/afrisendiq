"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand";
import { CoteDIvoireLanguageSwitch } from "@/app/components/CoteDIvoireLanguageSwitch";
import { resolveLocalizedText, useCoteDIvoireLocale, type LocalizedText } from "@/app/components/CoteDIvoireLocale";
import type { DtOneServiceType, NormalizedDtOneProduct } from "@/app/lib/dtoneCatalog";

type CoteDIvoireCatalogPageProps = {
  service: DtOneServiceType;
  title: LocalizedText;
  eyebrow: LocalizedText;
  brand?: "MTN" | "MOOV" | "ORANGE" | "CIE" | "JUMIA";
  description: LocalizedText;
  customerReferenceLabel: LocalizedText;
  recipientLabel: LocalizedText;
  emptyTitle: LocalizedText;
  emptyDescription: LocalizedText;
};

const sharedCopy = {
  notConfigured: {
    fr: "Ce service n'est pas encore disponible.",
    en: "This service is not available yet."
  },
  unableToLoadCatalog: {
    fr: "Impossible de charger les produits.",
    en: "Unable to load products."
  },
  backToHub: { fr: "Retour Côte d'Ivoire", en: "Back to Côte d'Ivoire" },
  openTopUp: { fr: "Recharge mobile", en: "Phone top-up" },
  openData: { fr: "Recharge connexion", en: "Data top-up" },
  heroBadge: { fr: "Soutrali", en: "Soutrali" },
  loadingProducts: { fr: "Chargement des produits...", en: "Loading products..." },
  productsAvailable: { fr: "produits disponibles", en: "products available" },
  catalogUnavailable: { fr: "Service indisponible", en: "Service unavailable" },
  serviceNotOpen: { fr: "Ce service n'est pas encore ouvert", en: "This service is not open yet" },
  filteredCheckout: { fr: "Achat", en: "Purchase" },
  product: { fr: "Produit", en: "Product" },
  chooseValidatedProduct: { fr: "Choisissez un produit", en: "Choose a product" },
  recipient: { fr: "Destinataire", en: "Recipient" },
  amount: { fr: "Montant", en: "Amount" },
  validatedRange: { fr: "Entrez le montant", en: "Enter amount" },
  validatingInputs: {
    fr: "Traitement de votre commande...",
    en: "Processing your order..."
  },
  unableToValidate: { fr: "Impossible de finaliser cet achat.", en: "Unable to complete this purchase." },
  validationReady: {
    fr: "Votre commande est prête.",
    en: "Your order is ready."
  },
  validating: { fr: "Envoi...", en: "Submitting..." },
  reviewCheckout: { fr: "Confirmer l'achat", en: "Confirm purchase" },
  loadingMatches: { fr: "Chargement des produits...", en: "Loading products..." },
  noCurrentMatches: { fr: "Aucun produit disponible", en: "No products available" },
  checkoutSummary: { fr: "Résumé de la commande", en: "Order summary" },
  selectedProduct: { fr: "Produit sélectionné", en: "Selected product" },
  reference: { fr: "Référence", en: "Reference" },
  validatedAmount: { fr: "Montant total", en: "Total amount" }
};

type CatalogState = {
  loading: boolean;
  configured: boolean;
  available: boolean;
  error: string | null;
  products: NormalizedDtOneProduct[];
};

const serviceGradient: Record<string, string> = {
  electricity: "from-[#D97706] via-[#F59E0B] to-[#FCD34D]",
  "gift-cards": "from-[#C2410C] via-[#EA580C] to-[#FB923C]",

};

const brandColor: Record<string, string> = {
  MTN: "#FFD200",
  MOOV: "#3B82F6",
  ORANGE: "#FF7900",
  CIE: "#D97706",
  JUMIA: "#EA580C",
};

export function CoteDIvoireCatalogPage({
  service,
  title,
  eyebrow,
  brand,
  description,
  customerReferenceLabel,
  recipientLabel,
  emptyTitle,
  emptyDescription,
}: CoteDIvoireCatalogPageProps) {
  const { locale } = useCoteDIvoireLocale();
  const [catalogState, setCatalogState] = useState<CatalogState>({
    loading: true,
    configured: false,
    available: false,
    error: null,
    products: []
  });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [recipientValue, setRecipientValue] = useState("");
  const [amount, setAmount] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<Record<string, unknown> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        const response = await fetch(`/api/dtone/catalog?service=${service}`);
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || resolveLocalizedText(sharedCopy.notConfigured, locale));
        }

        if (!isMounted) {
          return;
        }

        setCatalogState({
          loading: false,
          configured: Boolean(payload.configured),
          available: Boolean(payload.available),
          error: payload.reason || null,
          products: Array.isArray(payload.products) ? payload.products : []
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCatalogState({
          loading: false,
          configured: false,
          available: false,
          error: error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.unableToLoadCatalog, locale),
          products: []
        });
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [locale, service]);

  const selectedProduct = useMemo(
    () => catalogState.products.find((product) => product.id === selectedProductId) || null,
    [catalogState.products, selectedProductId]
  );

  const isCheckoutReady = Boolean(selectedProductId && customerReference.trim() && recipientValue.trim());

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#185740_0%,#0c2219_40%,#08140f_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />

          <div className="flex flex-wrap gap-3 text-sm">
            <CoteDIvoireLanguageSwitch />
            <Link href="/cote-divoire" className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-emerald-50 transition hover:bg-white/16">
              {resolveLocalizedText(sharedCopy.backToHub, locale)}
            </Link>
            <Link href="/cote-divoire/phone-top-up" className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-4 py-2 text-emerald-100 transition hover:bg-emerald-400/18">
              {resolveLocalizedText(sharedCopy.openTopUp, locale)}
            </Link>
            <Link href="/cote-divoire/data-top-up" className="rounded-full border border-blue-300/20 bg-blue-400/12 px-4 py-2 text-blue-100 transition hover:bg-blue-400/18">
              {resolveLocalizedText(sharedCopy.openData, locale)}
            </Link>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2rem] border border-white/12 bg-white/10 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">{resolveLocalizedText(eyebrow, locale)}</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">{resolveLocalizedText(title, locale)}</h1>
            {brand ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandColor[brand] || "#fff" }} />
                  {brand}
                </span>
              </div>
            ) : null}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78">{resolveLocalizedText(description, locale)}</p>

            {catalogState.loading ? (
              <div className="mt-6 rounded-2xl bg-black/20 px-4 py-3 text-sm text-emerald-100/80">
                {resolveLocalizedText(sharedCopy.loadingProducts, locale)}
              </div>
            ) : catalogState.available ? (
              <div className="mt-6 rounded-2xl bg-emerald-400/12 px-4 py-3 text-sm font-medium text-emerald-100">
                {catalogState.products.length} {resolveLocalizedText(sharedCopy.productsAvailable, locale)}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[2rem] shadow-[0_24px_80px_rgba(3,12,9,0.16)]">
            <div className={`relative flex h-72 items-center justify-center bg-gradient-to-br ${serviceGradient[service] || "from-[#065F46] via-[#059669] to-[#34D399]"}`}>
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/[0.08]" />
              <div className="absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-black/[0.06]" />
              <span className="relative select-none text-[2.6rem] font-black uppercase tracking-widest text-white/[0.06]">Soutrali</span>
              <div className="absolute left-5 top-5 rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                {resolveLocalizedText(sharedCopy.heroBadge, locale)}
              </div>
              {brand ? (
                <div className="absolute bottom-5 right-5 flex gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandColor[brand] || "#fff" }} />
                    {brand}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {catalogState.error && !catalogState.available && (
          <section className="mt-8 rounded-[1.75rem] border border-amber-300/18 bg-amber-400/12 p-5 text-amber-50 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/90">{resolveLocalizedText(sharedCopy.catalogUnavailable, locale)}</div>
            <h2 className="mt-2 text-xl font-semibold">{resolveLocalizedText(sharedCopy.serviceNotOpen, locale)}</h2>
            <p className="mt-3 text-sm leading-7 text-amber-50/86">{catalogState.error}</p>
          </section>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{resolveLocalizedText(sharedCopy.filteredCheckout, locale)}</div>

            <label className="mt-4 block text-sm font-semibold">{resolveLocalizedText(sharedCopy.product, locale)}</label>
            <select
              value={selectedProductId}
              onChange={(event) => {
                setSelectedProductId(event.target.value);
                setCheckoutSummary(null);
                setCheckoutStatus(null);
              }}
              disabled={!catalogState.available || catalogState.loading}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">{resolveLocalizedText(sharedCopy.chooseValidatedProduct, locale)}</option>
              {catalogState.products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.priceLabel})
                </option>
              ))}
            </select>

            <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(customerReferenceLabel, locale)}</label>
            <input
              value={customerReference}
              onChange={(event) => {
                setCustomerReference(event.target.value);
                setCheckoutSummary(null);
                setCheckoutStatus(null);
              }}
              placeholder={resolveLocalizedText(customerReferenceLabel, locale)}
              disabled={!catalogState.available}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(recipientLabel, locale)}</label>
            <input
              value={recipientValue}
              onChange={(event) => {
                setRecipientValue(event.target.value);
                setCheckoutSummary(null);
                setCheckoutStatus(null);
              }}
              placeholder={resolveLocalizedText(recipientLabel, locale)}
              disabled={!catalogState.available}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <label className="mt-5 block text-sm font-semibold">{resolveLocalizedText(sharedCopy.amount, locale)} {selectedProduct?.currency ? `(${selectedProduct.currency})` : ""}</label>
            <input
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setCheckoutSummary(null);
                setCheckoutStatus(null);
              }}
              placeholder={selectedProduct?.priceLabel || resolveLocalizedText(sharedCopy.validatedRange, locale)}
              disabled={!catalogState.available}
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            {checkoutStatus && (
              <div className="mt-5 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{checkoutStatus}</div>
            )}

            <button
              disabled={!catalogState.available || !isCheckoutReady || submitting}
              onClick={async () => {
                setSubmitting(true);
                setCheckoutStatus(resolveLocalizedText(sharedCopy.validatingInputs, locale));
                setCheckoutSummary(null);

                try {
                  const response = await fetch("/api/dtone/checkout", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      service,
                      productId: selectedProductId,
                      customerReference,
                      recipientLabel: recipientValue,
                      amount: amount ? Number(amount) : undefined
                    })
                  });

                  const payload = await response.json();

                  if (!response.ok || !payload.success) {
                    throw new Error(payload.error || resolveLocalizedText(sharedCopy.unableToValidate, locale));
                  }

                  setCheckoutSummary(payload);
                  setCheckoutStatus(resolveLocalizedText(sharedCopy.validationReady, locale));
                } catch (error) {
                  setCheckoutStatus(error instanceof Error ? error.message : resolveLocalizedText(sharedCopy.unableToValidate, locale));
                } finally {
                  setSubmitting(false);
                }
              }}
              className="mt-6 w-full rounded-xl bg-[#0F3D2E] px-4 py-3 font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:bg-[#4d6a5f]"
            >
              {submitting ? resolveLocalizedText(sharedCopy.validating, locale) : resolveLocalizedText(sharedCopy.reviewCheckout, locale)}
            </button>
          </div>

          <div>
          {catalogState.loading ? (
            <div className="rounded-[1.75rem] border border-white/12 bg-white/8 p-6 text-sm text-emerald-50/80 backdrop-blur">
              {resolveLocalizedText(sharedCopy.loadingMatches, locale)}
            </div>
          ) : catalogState.available ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
              {catalogState.products.slice(0, 8).map((product) => (
                <article key={product.id} className="rounded-[1.75rem] bg-white p-6 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{product.country}</div>
                  <h2 className="mt-3 text-xl font-semibold leading-tight">{product.name}</h2>
                  {brand ? (
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandColor[brand] || "#059669" }} />
                        {brand}
                      </span>
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>
                  <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-emerald-800">
                    {product.priceLabel}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{resolveLocalizedText(sharedCopy.noCurrentMatches, locale)}</div>
              <h2 className="mt-3 text-2xl font-semibold">{resolveLocalizedText(emptyTitle, locale)}</h2>
              {brand ? (
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandColor[brand] || "#059669" }} />
                    {brand}
                  </span>
                </div>
              ) : null}
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{resolveLocalizedText(emptyDescription, locale)}</p>
            </div>
          )}

          {checkoutSummary && (
            <div className="mt-6 rounded-[1.75rem] bg-white p-7 text-[#0E2E23] shadow-[0_24px_80px_rgba(0,0,0,0.15)]">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{resolveLocalizedText(sharedCopy.checkoutSummary, locale)}</div>
              <h2 className="mt-3 text-2xl font-semibold">{String((checkoutSummary.product as Record<string, unknown>)?.name || resolveLocalizedText(sharedCopy.selectedProduct, locale))}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#F5FBF8] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{resolveLocalizedText(sharedCopy.reference, locale)}</div>
                  <div className="mt-2 text-lg font-semibold">{String(checkoutSummary.checkoutReference || "")}</div>
                </div>
                <div className="rounded-2xl bg-[#F5FBF8] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">{resolveLocalizedText(sharedCopy.validatedAmount, locale)}</div>
                  <div className="mt-2 text-lg font-semibold">{String(((checkoutSummary.checkout as Record<string, unknown>)?.amount) || "")} {String(((checkoutSummary.checkout as Record<string, unknown>)?.currency) || "")}</div>
                </div>
              </div>
            </div>
          )}
          </div>
        </section>
      </div>
    </main>
  );
}