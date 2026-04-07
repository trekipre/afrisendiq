import { processProviderCatalogCheckout } from "@/app/lib/providerCatalogCheckout"
import { listExecutionTelemetry, resetExecutionTelemetry } from "@/app/lib/executionTelemetry"
import { resetTransactions, transactions } from "@/app/lib/ledger"
import { listProviderCatalogOrders, resetProviderCatalogOrders } from "@/app/lib/providerCatalogOrderState"

describe("provider catalog checkout", () => {
  beforeEach(() => {
    resetExecutionTelemetry()
    resetTransactions()
    resetProviderCatalogOrders()
  })

  afterEach(() => {
    delete process.env.RELOADLY_TRANSACTION_MODE
    delete process.env.DING_TRANSACTION_MODE
    delete process.env.DTONE_TRANSACTION_MODE
  })

  it("completes a simulated DT One Jumia purchase and records telemetry", async () => {
    const sendPurchaseConfirmationSms = vi.fn(async () => ({
      delivered: false as const,
      reason: "No valid recipient phone was available for confirmation SMS",
    }))

    const result = await processProviderCatalogCheckout(
      {
        provider: "dtone",
        productId: "dtone-jumia-gift-card",
        customerReference: "ORDER-1",
        recipientLabel: "Recipient",
        amount: 10000,
        senderName: "Kipre",
      },
      {
        createReference: () => "DTONE-TEST-1",
        createTraceId: () => "trace-dtone-1",
        sendPurchaseConfirmationSms,
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.completionMode).toBe("simulated")
    expect(transactions[0]?.provider).toBe("DTONE")
    expect(listProviderCatalogOrders()[0]?.status).toBe("completed")
    expect(listExecutionTelemetry("trace-dtone-1").map((event) => event.type)).toContain("purchase.completed")
    expect(sendPurchaseConfirmationSms).toHaveBeenCalledWith({
      reference: "DTONE-TEST-1",
      productLabel: "DT One Jumia Voucher",
      productCategory: "gift-card",
      productBrand: "JUMIA",
      amount: 10000,
      currency: "XOF",
      recipientPhoneCandidates: ["ORDER-1"],
      senderName: "Kipre",
      rechargeCode: undefined,
    })
  })

  it("delegates Reloadly live airtime through injected provider functions", async () => {
    process.env.RELOADLY_TRANSACTION_MODE = "live"
    const sendPurchaseConfirmationSms = vi.fn(async () => ({
      delivered: true as const,
      to: "+2250700000000",
      sid: "SM_PROVIDER_CONFIRM",
      whatsappSid: "WA_PROVIDER_CONFIRM",
      body: "AfriSendIQ purchase confirmed.",
    }))

    const result = await processProviderCatalogCheckout(
      {
        provider: "reloadly",
        productId: "reloadly-orange-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "Recipient",
        amount: 5000,
        senderName: "Kipre",
      },
      {
        createReference: () => "RELOADLY-TEST-1",
        createTraceId: () => "trace-reloadly-1",
        detectReloadlyOperator: async () => ({ operatorId: 42, name: "Orange CI" }),
        sendReloadlyAirtime: async () => ({ status: "submitted", transactionId: "tx-1" }),
        sendPurchaseConfirmationSms,
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.completionMode).toBe("live")
    expect(listProviderCatalogOrders()[0]?.status).toBe("completed")
    expect(transactions[0]?.provider).toBe("RELOADLY")
    expect(sendPurchaseConfirmationSms).toHaveBeenCalled()
  })

  it("delegates Ding live airtime through injected provider functions", async () => {
    process.env.DING_TRANSACTION_MODE = "live"

    const result = await processProviderCatalogCheckout(
      {
        provider: "ding",
        productId: "ding-orange-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "Recipient",
        amount: 5000
      },
      {
        createReference: () => "DING-TEST-1",
        createTraceId: () => "trace-ding-1",
        getDingProviders: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          Items: [
            {
              ProviderCode: "ORANGE_CI",
              CountryIso: "CI",
              Name: "Orange Ivory Coast"
            }
          ]
        }),
        getDingProducts: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          Items: [
            {
              ProviderCode: "ORANGE_CI",
              SkuCode: "SKU-ORANGE-5000",
              LocalizationKey: "orange-5000",
              SettingDefinitions: [],
              Minimum: {
                CustomerFee: 0,
                DistributorFee: 0,
                ReceiveValue: 5000,
                ReceiveCurrencyIso: "XOF",
                SendValue: 8.75,
                SendCurrencyIso: "USD"
              },
              Maximum: {
                CustomerFee: 0,
                DistributorFee: 0,
                ReceiveValue: 5000,
                ReceiveCurrencyIso: "XOF",
                SendValue: 8.75,
                SendCurrencyIso: "USD"
              },
              CommissionRate: 0,
              ProcessingMode: "RealTime",
              RedemptionMechanism: "Immediate",
              Benefits: ["Mobile"],
              LookupBillsRequired: false
            }
          ]
        }),
        sendDingTransfer: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          TransferRecord: {
            TransferId: {
              TransferRef: "transfer-1",
              DistributorRef: "DING-TEST-1"
            },
            SkuCode: "SKU-ORANGE-5000",
            ProcessingState: "Completed",
            AccountNumber: "+2250700000000"
          }
        }),
        listDingTransferRecords: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          Items: []
        })
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.completionMode).toBe("live")
  const transaction = result.body.transaction as Record<string, unknown> | undefined
  expect(transaction?.skuCode).toBe("SKU-ORANGE-5000")
  expect(transaction?.status).toBe("completed")
    expect(listProviderCatalogOrders()[0]?.status).toBe("completed")
    expect(transactions[0]?.provider).toBe("DING")
  })

  it("fails when the phone prefix does not match the selected airtime brand", async () => {
    process.env.RELOADLY_TRANSACTION_MODE = "live"
    const sendPurchaseConfirmationSms = vi.fn()

    const result = await processProviderCatalogCheckout(
      {
        provider: "reloadly",
        productId: "reloadly-mtn-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "Recipient",
        amount: 5000
      },
      {
        createReference: () => "RELOADLY-TEST-2",
        createTraceId: () => "trace-reloadly-2",
        sendPurchaseConfirmationSms,
      }
    )

    expect(result.status).toBe(500)
    expect(result.body.success).toBe(false)
    expect(String(result.body.error)).toContain("Selected product is for MTN")
    expect(listProviderCatalogOrders()[0]?.status).toBe("failed")
    expect(sendPurchaseConfirmationSms).not.toHaveBeenCalled()
  })

  it("delegates DT One live airtime through injected provider functions", async () => {
    process.env.DTONE_TRANSACTION_MODE = "live"

    const result = await processProviderCatalogCheckout(
      {
        provider: "dtone",
        productId: "dtone-orange-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "Recipient",
        amount: 5000
      },
      {
        createReference: () => "DTONE-TEST-2",
        createTraceId: () => "trace-dtone-2",
        sendDTOneTransaction: async () => ({
          id: 90001,
          external_id: "DTONE-TEST-2",
          status: { id: 20000, message: "COMPLETED" },
          product: { id: 999, name: "Orange CI Airtime" }
        }),
        lookupDTOneProduct: async () => ({
          id: 999,
          name: "Orange CI Airtime",
          type: "FIXED_VALUE_RECHARGE"
        })
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.completionMode).toBe("live")
  const transaction = result.body.transaction as Record<string, unknown> | undefined
  expect(transaction?.transactionId).toBe(90001)
  expect(transaction?.status).toBe("completed")
    expect(listProviderCatalogOrders()[0]?.status).toBe("completed")
    expect(transactions[0]?.provider).toBe("DTONE")
  })

  it("fails DT One airtime when phone prefix does not match brand", async () => {
    process.env.DTONE_TRANSACTION_MODE = "live"

    const result = await processProviderCatalogCheckout(
      {
        provider: "dtone",
        productId: "dtone-mtn-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "Recipient",
        amount: 5000
      },
      {
        createReference: () => "DTONE-TEST-3",
        createTraceId: () => "trace-dtone-3"
      }
    )

    expect(result.status).toBe(500)
    expect(result.body.success).toBe(false)
    expect(String(result.body.error)).toContain("Selected product is for MTN")
    expect(listProviderCatalogOrders()[0]?.status).toBe("failed")
  })
})