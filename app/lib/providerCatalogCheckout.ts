import { recordExecutionTelemetry as recordExecutionTelemetryDefault } from "@/app/lib/executionTelemetry"
import { logTransaction as logTransactionDefault } from "@/app/lib/ledger"
import { sendPurchaseConfirmationSms as sendPurchaseConfirmationSmsDefault } from "@/app/lib/purchaseConfirmation"
import {
  createProviderCatalogOrder,
  transitionProviderCatalogOrder,
  type ProviderCatalogOrder
} from "@/app/lib/providerCatalogOrderState"
import {
  getCoteDIvoireCatalogProduct,
  getProviderTransactionMode,
  inferCiBrandFromPhone,
  type CoteDIvoireCatalogProduct,
  type CoteDIvoireProvider
} from "@/app/lib/coteDivoireCatalog"
import { detectOperator, sendAirtime } from "@/app/providers/reloadly"
import {
  getDingProducts,
  getDingProviders,
  listDingTransferRecords,
  sendDingTransfer,
  type DingProduct,
  type DingProvider,
  type DingTransferRecordItem
} from "@/app/providers/ding"
import {
  sendDTOneTransaction,
  lookupDTOneProduct
} from "@/app/lib/dtone"

type ProviderCatalogCheckoutBody = {
  provider?: string
  productId?: string
  customerReference?: string
  recipientLabel?: string
  amount?: number
  senderName?: string
}

type ProviderCatalogCheckoutDependencies = {
  createReference: (provider: CoteDIvoireProvider) => string
  createTraceId: () => string
  detectReloadlyOperator: typeof detectOperator
  sendReloadlyAirtime: typeof sendAirtime
  getDingProviders: typeof getDingProviders
  getDingProducts: typeof getDingProducts
  sendDingTransfer: typeof sendDingTransfer
  listDingTransferRecords: typeof listDingTransferRecords
  sendDTOneTransaction: typeof sendDTOneTransaction
  lookupDTOneProduct: typeof lookupDTOneProduct
  logTransaction: typeof logTransactionDefault
  recordExecutionTelemetry: typeof recordExecutionTelemetryDefault
  sendPurchaseConfirmationSms: typeof sendPurchaseConfirmationSmsDefault
  simulateProviderExecution: (input: {
    provider: CoteDIvoireProvider
    product: CoteDIvoireCatalogProduct
    amount: number
    customerReference: string
    recipientLabel: string
    reference: string
  }) => Promise<Record<string, unknown>>
}

export type ProviderCatalogCheckoutResponse = {
  status: number
  body: Record<string, unknown>
}

const defaultDependencies: ProviderCatalogCheckoutDependencies = {
  createReference: (provider) => `${provider.toUpperCase()}-${Date.now()}`,
  createTraceId: () => crypto.randomUUID(),
  detectReloadlyOperator: detectOperator,
  sendReloadlyAirtime: sendAirtime,
  getDingProviders,
  getDingProducts,
  sendDingTransfer,
  listDingTransferRecords,
  sendDTOneTransaction,
  lookupDTOneProduct,
  logTransaction: logTransactionDefault,
  recordExecutionTelemetry: recordExecutionTelemetryDefault,
  sendPurchaseConfirmationSms: sendPurchaseConfirmationSmsDefault,
  simulateProviderExecution: async ({ provider, product, amount, customerReference, recipientLabel, reference }) => ({
    reference,
    provider,
    status: "completed",
    mode: "simulated",
    productId: product.id,
    productName: product.name,
    amount,
    customerReference,
    recipientLabel,
    completedAt: new Date().toISOString()
  })
}

function isProvider(value: string): value is CoteDIvoireProvider {
  return value === "reloadly" || value === "ding" || value === "dtone"
}

function transitionOrder(
  order: ProviderCatalogOrder,
  nextStatus: Parameters<typeof transitionProviderCatalogOrder>[1],
  deps: ProviderCatalogCheckoutDependencies,
  patch: Parameters<typeof transitionProviderCatalogOrder>[2] = {},
  note?: string
) {
  const updatedOrder = transitionProviderCatalogOrder(order, nextStatus, patch, note)
  deps.recordExecutionTelemetry({
    traceId: updatedOrder.traceId,
    orderId: updatedOrder.id,
    type: "order.transitioned",
    provider: updatedOrder.provider,
    metadata: {
      from: order.status,
      to: nextStatus,
      note
    }
  })

  return updatedOrder
}

function normalizeDingResultCode(resultCode: number | undefined) {
  return resultCode === 1 || resultCode === 0
}

function formatDingErrors(errorCodes: Array<{ Code: string; Context?: string }> | undefined) {
  if (!errorCodes || errorCodes.length === 0) {
    return ""
  }

  return errorCodes.map((error) => `${error.Code}${error.Context ? ` (${error.Context})` : ""}`).join(", ")
}

function getMatchingDingProviderCodes(providers: DingProvider[], brand: CoteDIvoireCatalogProduct["brand"]) {
  const normalizedBrand = brand.toLowerCase()

  return new Set(
    providers
      .filter((provider) => {
        const normalizedName = provider.Name.toLowerCase()
        return normalizedName.includes(normalizedBrand) && !normalizedName.includes("data")
      })
      .map((provider) => provider.ProviderCode)
  )
}

function getMatchingDingAirtimeProduct(products: DingProduct[], providerCodes: Set<string>, amount: number) {
  const candidates = products.filter((product) => {
    const benefitSet = new Set(product.Benefits || [])
    return (
      providerCodes.has(product.ProviderCode) &&
      benefitSet.has("Mobile") &&
      !benefitSet.has("Data") &&
      !benefitSet.has("Internet") &&
      !product.LookupBillsRequired &&
      product.Minimum.ReceiveCurrencyIso === "XOF" &&
      product.Maximum.ReceiveCurrencyIso === "XOF"
    )
  })

  return candidates.find((product) => product.Minimum.ReceiveValue === amount && product.Maximum.ReceiveValue === amount)
}

async function executeReloadlyCatalogPurchase(
  product: CoteDIvoireCatalogProduct,
  customerReference: string,
  amount: number,
  reference: string,
  deps: ProviderCatalogCheckoutDependencies
) {
  const inferredBrand = inferCiBrandFromPhone(customerReference)

  if (!inferredBrand) {
    throw new Error("Recipient phone must be a Côte d'Ivoire mobile number for airtime completion")
  }

  if (inferredBrand !== product.brand) {
    throw new Error(`Selected product is for ${product.brand}, but the phone prefix resolves to ${inferredBrand}`)
  }

  const operator = await deps.detectReloadlyOperator(customerReference, "CI")

  if (!operator.operatorId) {
    throw new Error("Reloadly could not resolve an operator for this phone number")
  }

  return deps.sendReloadlyAirtime({
    operatorId: operator.operatorId,
    phone: customerReference,
    amount,
    reference
  })
}

async function executeDingCatalogPurchase(
  product: CoteDIvoireCatalogProduct,
  customerReference: string,
  amount: number,
  reference: string,
  deps: ProviderCatalogCheckoutDependencies,
  traceId: string
) {
  const inferredBrand = inferCiBrandFromPhone(customerReference)

  if (!inferredBrand) {
    throw new Error("Recipient phone must be a Côte d'Ivoire mobile number for Ding airtime completion")
  }

  if (inferredBrand !== product.brand) {
    throw new Error(`Selected product is for ${product.brand}, but the phone prefix resolves to ${inferredBrand}`)
  }

  const [providerResponse, productResponse] = await Promise.all([
    deps.getDingProviders({ countryIsos: ["CI"], accountNumber: customerReference, correlationId: traceId }),
    deps.getDingProducts({ countryIsos: ["CI"], accountNumber: customerReference, benefits: ["Mobile"], correlationId: traceId })
  ])

  if (!normalizeDingResultCode(providerResponse.ResultCode)) {
    throw new Error(`Ding provider discovery failed: ${formatDingErrors(providerResponse.ErrorCodes) || "unknown error"}`)
  }

  if (!normalizeDingResultCode(productResponse.ResultCode)) {
    throw new Error(`Ding product discovery failed: ${formatDingErrors(productResponse.ErrorCodes) || "unknown error"}`)
  }

  const matchingProviderCodes = getMatchingDingProviderCodes(providerResponse.Items || [], product.brand)

  if (matchingProviderCodes.size === 0) {
    throw new Error(`Ding could not resolve a ${product.brand} Côte d'Ivoire provider for this phone number`)
  }

  const matchedProduct = getMatchingDingAirtimeProduct(productResponse.Items || [], matchingProviderCodes, amount)

  if (!matchedProduct) {
    throw new Error(`Ding does not currently expose an exact ${amount} XOF airtime SKU for ${product.brand} Côte d'Ivoire in the live catalog`)
  }

  const transferResponse = await deps.sendDingTransfer({
    skuCode: matchedProduct.SkuCode,
    sendValue: matchedProduct.Minimum.SendValue,
    sendCurrencyIso: matchedProduct.Minimum.SendCurrencyIso,
    accountNumber: customerReference,
    distributorRef: reference,
    validateOnly: false,
    correlationId: traceId
  })

  if (!normalizeDingResultCode(transferResponse.ResultCode)) {
    throw new Error(`Ding transfer failed: ${formatDingErrors(transferResponse.ErrorCodes) || "unknown error"}`)
  }

  let transferRecord = transferResponse.TransferRecord

  if (transferRecord?.ProcessingState === "Submitted" || transferRecord?.ProcessingState === "Processing") {
    const recordsResponse = await deps.listDingTransferRecords({ distributorRef: reference, take: 1, correlationId: traceId })

    if (normalizeDingResultCode(recordsResponse.ResultCode)) {
      const latestRecord = (recordsResponse.Items || [])[0] as DingTransferRecordItem | undefined
      if (latestRecord?.TransferRecord) {
        transferRecord = latestRecord.TransferRecord
      }
    }
  }

  return {
    status: String(transferRecord?.ProcessingState || "Submitted").toLowerCase(),
    mode: "live",
    skuCode: matchedProduct.SkuCode,
    providerCode: matchedProduct.ProviderCode,
    requestedReceiveValue: amount,
    sendValue: matchedProduct.Minimum.SendValue,
    sendCurrencyIso: matchedProduct.Minimum.SendCurrencyIso,
    transferRecord,
    resultCode: transferResponse.ResultCode,
    errorCodes: transferResponse.ErrorCodes
  }
}

async function executeDTOneCatalogPurchase(
  product: CoteDIvoireCatalogProduct,
  customerReference: string,
  amount: number,
  reference: string,
  deps: ProviderCatalogCheckoutDependencies
) {
  if (product.category === "airtime") {
    const inferredBrand = inferCiBrandFromPhone(customerReference)

    if (!inferredBrand) {
      throw new Error("Recipient phone must be a Côte d'Ivoire mobile number for DT One airtime completion")
    }

    if (inferredBrand !== product.brand) {
      throw new Error(`Selected product is for ${product.brand}, but the phone prefix resolves to ${inferredBrand}`)
    }
  }

  const dtoneProductId = Number(product.id.replace(/\D/g, "") || "0")
  let resolvedProductId = dtoneProductId

  if (dtoneProductId === 0) {
    const looked = await deps.lookupDTOneProduct(0)
    resolvedProductId = looked.id
  }

  const transaction = await deps.sendDTOneTransaction({
    productId: resolvedProductId,
    creditPartyIdentifier: {
      mobile_number: customerReference
    },
    sourceAmount: amount,
    externalId: reference
  })

  return {
    status: String(transaction.status?.message || "SUBMITTED").toLowerCase(),
    mode: "live",
    productId: resolvedProductId,
    transactionId: transaction.id,
    externalId: transaction.external_id,
    transaction
  }
}

export async function processProviderCatalogCheckout(
  body: unknown,
  overrides: Partial<ProviderCatalogCheckoutDependencies> = {}
): Promise<ProviderCatalogCheckoutResponse> {
  const deps = { ...defaultDependencies, ...overrides }
  const request = typeof body === "object" && body !== null ? body as ProviderCatalogCheckoutBody : {}
  const provider = String(request.provider || "").trim()
  const productId = String(request.productId || "").trim()
  const customerReference = String(request.customerReference || "").trim()
  const recipientLabel = String(request.recipientLabel || "").trim()
  const amount = Number(request.amount)
  const senderName = String(request.senderName || "").trim() || undefined

  if (!provider || !isProvider(provider)) {
    return { status: 400, body: { success: false, error: "A valid provider is required" } }
  }

  const product = getCoteDIvoireCatalogProduct(productId)

  if (!product || product.provider !== provider) {
    return { status: 404, body: { success: false, error: "Selected Côte d'Ivoire product was not found for this provider" } }
  }

  if (!customerReference) {
    return { status: 400, body: { success: false, error: `${product.customerReferenceLabel} is required` } }
  }

  if (!recipientLabel) {
    return { status: 400, body: { success: false, error: `${product.recipientLabel} is required` } }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { status: 400, body: { success: false, error: "Amount must be a positive number" } }
  }

  if (amount < product.minAmount || amount > product.maxAmount) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Amount must stay between ${product.minAmount} and ${product.maxAmount} ${product.currency}`
      }
    }
  }

  const traceId = deps.createTraceId()
  const reference = deps.createReference(provider)
  const completionMode = getProviderTransactionMode(provider)
  let order = createProviderCatalogOrder({
    id: reference,
    traceId,
    provider,
    productId: product.id,
    productName: product.name,
    customerReference,
    recipientLabel,
    amount,
    completionMode
  })

  deps.recordExecutionTelemetry({
    traceId,
    orderId: order.id,
    type: "order.created",
    provider,
    metadata: {
      productId: product.id,
      amount,
      completionMode
    }
  })

  try {
    order = transitionOrder(order, "validated", deps, {}, "Catalog product validated")
    order = transitionOrder(order, "executing", deps, {}, `Executing via ${provider}`)

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "provider.attempt.started",
      provider,
      metadata: {
        completionMode,
        productId: product.id
      }
    })

    let transaction: Record<string, unknown>

    if (provider === "reloadly" && completionMode === "live") {
      transaction = await executeReloadlyCatalogPurchase(product, customerReference, amount, reference, deps)
    } else if (provider === "ding" && completionMode === "live") {
      transaction = await executeDingCatalogPurchase(product, customerReference, amount, reference, deps, traceId)
    } else if (provider === "dtone" && completionMode === "live") {
      transaction = await executeDTOneCatalogPurchase(product, customerReference, amount, reference, deps)
    } else {
      transaction = await deps.simulateProviderExecution({
        provider,
        product,
        amount,
        customerReference,
        recipientLabel,
        reference
      })
    }

    order = transitionOrder(order, "completed", deps, {}, "Provider transaction completed")

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "provider.attempt.succeeded",
      provider,
      metadata: {
        completionMode,
        productId: product.id
      }
    })

    deps.logTransaction({
      id: reference,
      traceId,
      phone: customerReference,
      operator: product.name,
      amount,
      status: String((transaction as Record<string, unknown>).status || "completed"),
      provider: provider.toUpperCase()
    })

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.completed",
      provider,
      metadata: {
        completionMode,
        productId: product.id
      }
    })

    try {
      const rechargeCode = typeof transaction.rechargeCode === "string"
        ? String(transaction.rechargeCode)
        : undefined
      const confirmation = await deps.sendPurchaseConfirmationSms({
        reference,
        productLabel: product.name,
        productCategory: product.category,
        productBrand: product.brand,
        amount,
        currency: product.currency,
        recipientPhoneCandidates: [customerReference],
        senderName,
        rechargeCode,
      })

      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: confirmation.delivered ? "customer.notification.sent" : "customer.notification.skipped",
        provider,
        message: confirmation.delivered ? undefined : confirmation.reason,
        metadata: confirmation.delivered
          ? {
              channel: confirmation.whatsappSid ? "twilio_whatsapp" : "twilio_sms",
              sid: confirmation.sid,
              whatsappSid: confirmation.whatsappSid,
              to: confirmation.to,
            }
          : {
              channel: "twilio_sms",
              reason: confirmation.reason,
            }
      })
    } catch (error) {
      deps.recordExecutionTelemetry({
        traceId,
        orderId: order.id,
        type: "customer.notification.failed",
        provider,
        message: error instanceof Error ? error.message : "Unable to send purchase confirmation SMS",
        metadata: {
          channel: "twilio_sms",
        }
      })
    }

    return {
      status: 200,
      body: {
        success: true,
        traceId,
        reference,
        provider,
        completionMode,
        product,
        transaction
      }
    }
  } catch (error) {
    order = transitionOrder(
      order,
      "failed",
      deps,
      { failureReason: error instanceof Error ? error.message : "Unable to complete provider transaction" },
      "Provider transaction failed"
    )

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "provider.attempt.failed",
      provider,
      message: error instanceof Error ? error.message : "Unable to complete provider transaction",
      metadata: {
        completionMode,
        productId: product.id
      }
    })

    deps.recordExecutionTelemetry({
      traceId,
      orderId: order.id,
      type: "purchase.failed",
      provider,
      message: error instanceof Error ? error.message : "Unable to complete provider transaction"
    })

    return {
      status: 500,
      body: {
        success: false,
        traceId,
        error: error instanceof Error ? error.message : "Unable to complete provider transaction"
      }
    }
  }
}