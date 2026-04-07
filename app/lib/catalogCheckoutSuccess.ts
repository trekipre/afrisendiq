type CatalogCompletionKind = "airtime" | "data" | "electricity" | "gift-card"

type CatalogCheckoutProduct = {
  name: string
  category: CatalogCompletionKind
}

type CatalogCheckoutPayload = {
  reference?: string
  product?: {
    name?: string
  }
  transaction?: {
    status?: string
    rechargeCode?: string
    completedAt?: string
  }
}

export type CompletedCatalogCheckout = {
  kind: CatalogCheckoutProduct["category"];
  reference: string;
  productName: string;
  amount: number;
  currency: string;
  customerReference: string;
  customerReferenceLabel: string;
  recipientValue: string;
  recipientLabel: string;
  usesSharedContactField: boolean;
  rechargeCode?: string;
  completedAt?: string;
  logoSrc?: string;
};

export type CatalogCheckoutProductDetails = CatalogCheckoutProduct & {
  currency: string;
  customerReferenceLabel: string;
  recipientLabel: string;
  serviceLogoPath?: string;
};

export type CatalogCheckoutSuccessResolution =
  {
      type: "show-completion";
      completion: CompletedCatalogCheckout;
    };

type ResolveCatalogCheckoutSuccessParams = {
  product: CatalogCheckoutProductDetails;
  payload: CatalogCheckoutPayload;
  fallbackReference: string;
  amount: number;
  customerReference: string;
  recipientValue: string;
  usesSharedContactField: boolean;
};

export function resolveCatalogCheckoutSuccess({
  product,
  payload,
  fallbackReference,
  amount,
  customerReference,
  recipientValue,
  usesSharedContactField,
}: ResolveCatalogCheckoutSuccessParams): CatalogCheckoutSuccessResolution {
  return {
    type: "show-completion",
    completion: {
      kind: product.category,
      reference: String(payload.reference || fallbackReference),
      productName: payload.product?.name || product.name,
      amount,
      currency: product.currency || "XOF",
      customerReference,
      customerReferenceLabel: product.customerReferenceLabel,
      recipientValue,
      recipientLabel: product.recipientLabel,
      usesSharedContactField,
      rechargeCode: payload.transaction?.rechargeCode,
      completedAt: payload.transaction?.completedAt,
      logoSrc: product.serviceLogoPath,
    },
  };
}