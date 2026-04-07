import { processSoutraliCheckout, quoteSoutraliProduct, listSoutraliProducts } from "@/app/lib/soutraliEngine"
import { listExecutionTelemetry, resetExecutionTelemetry } from "@/app/lib/executionTelemetry"
import { resetTransactions, transactions } from "@/app/lib/ledger"
import { listSoutraliOrders, resetSoutraliOrders } from "@/app/lib/soutraliOrderState"

describe("Soutrali engine", () => {
  beforeEach(() => {
    resetExecutionTelemetry()
    resetTransactions()
    resetSoutraliOrders()
  })

  afterEach(() => {
    delete process.env.RELOADLY_TRANSACTION_MODE
    delete process.env.DING_TRANSACTION_MODE
  })

  it("lists Soutrali CI airtime products instead of provider products", () => {
    const products = listSoutraliProducts()
    const airtimeIds = products.filter((p) => p.category === "airtime").map((p) => p.id)
    const dataIds = products.filter((p) => p.category === "data").map((p) => p.id)
    const giftCardIds = products.filter((p) => p.category === "gift-card").map((p) => p.id)
    const electricityIds = products.filter((p) => p.category === "electricity").map((p) => p.id)

    expect(airtimeIds).toEqual([
      "soutrali-ci-mtn-airtime",
      "soutrali-ci-moov-airtime",
      "soutrali-ci-orange-airtime"
    ])

    expect(dataIds.length).toBeGreaterThanOrEqual(15)
    expect(dataIds.every((id) => id.startsWith("soutrali-ci-"))).toBe(true)
    expect(giftCardIds).toEqual(["soutrali-ci-jumia-gift-card"])
    expect(electricityIds).toEqual([])

    const mtnBundle = products.find((p) => p.brand === "MTN" && p.category === "data" && p.dataAllowance === "7400 MB Data" && p.validity === "30 jours")
    expect(mtnBundle?.amountOptions).toEqual([5000])

    const orangeBundle = products.find((p) => p.brand === "ORANGE" && p.category === "data" && p.dataAllowance === "7.2 GB" && p.validity === "30 jours")
    expect(orangeBundle?.amountOptions).toEqual([5000])

    const moovBundle = products.find((p) => p.brand === "MOOV" && p.category === "data" && p.dataAllowance === "400 mins + 500 SMS + 2.5 Gb" && p.validity === "30 jours")
    expect(moovBundle?.amountOptions).toEqual([5000])
  })

  it("quotes the best live provider offer with a customer and margin aware score", async () => {
    process.env.RELOADLY_TRANSACTION_MODE = "live"
    process.env.DING_TRANSACTION_MODE = "live"

    const quote = await quoteSoutraliProduct(
      {
        productId: "soutrali-ci-orange-airtime",
        amount: 5000,
        customerReference: "+2250700000000"
      },
      {
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
                SendValue: 7,
                SendCurrencyIso: "USD"
              },
              Maximum: {
                CustomerFee: 0,
                DistributorFee: 0,
                ReceiveValue: 5000,
                ReceiveCurrencyIso: "XOF",
                SendValue: 7,
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
        convertUsdAmount: async () => ({
          baseCode: "USD",
          rates: { XOF: 600 },
          fetchedAt: new Date().toISOString(),
          source: "fallback",
          stale: true,
          currencyCode: "XOF",
          rate: 600,
          converted: 4200
        })
      }
    )

    expect(quote.bestOffer.provider).toBe("ding")
    expect(quote.bestOffer.executionMode).toBe("live")
    expect(quote.bestOffer.customerPrice).toBeGreaterThan(quote.bestOffer.providerCost)
  })

  it("completes a Soutrali checkout while hiding provider details from the customer response", async () => {
    process.env.RELOADLY_TRANSACTION_MODE = "live"
    process.env.DING_TRANSACTION_MODE = "live"
    const sendPurchaseConfirmationSms = vi.fn(async () => ({
      delivered: true as const,
      to: "+2250700000000",
      sid: "SM_SOUTRALI_CONFIRM",
      whatsappSid: "WA_SOUTRALI_CONFIRM",
      body: "AfriSendIQ purchase confirmed.",
    }))

    const result = await processSoutraliCheckout(
      {
        productId: "soutrali-ci-orange-airtime",
        customerReference: "+2250700000000",
        recipientLabel: "+2250700000000",
        amount: 5000,
        senderName: "Kipre",
      },
      {
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
                SendValue: 7,
                SendCurrencyIso: "USD"
              },
              Maximum: {
                CustomerFee: 0,
                DistributorFee: 0,
                ReceiveValue: 5000,
                ReceiveCurrencyIso: "XOF",
                SendValue: 7,
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
        convertUsdAmount: async () => ({
          baseCode: "USD",
          rates: { XOF: 600 },
          fetchedAt: new Date().toISOString(),
          source: "fallback",
          stale: true,
          currencyCode: "XOF",
          rate: 600,
          converted: 4200
        }),
        sendDingTransfer: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          TransferRecord: {
            TransferId: {
              TransferRef: "transfer-1",
              DistributorRef: "SOUTRALI-TEST-1"
            },
            ProcessingState: "Completed",
            AccountNumber: "+2250700000000"
          }
        }),
        listDingTransferRecords: async () => ({
          ResultCode: 1,
          ErrorCodes: [],
          Items: []
        }),
        createReference: () => "SOUTRALI-TEST-1",
        createTraceId: () => "trace-soutrali-1",
        sendPurchaseConfirmationSms,
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.product).toBeDefined()
    expect(result.body.transaction).toMatchObject({
      reference: "SOUTRALI-TEST-1",
      status: "completed",
      pending: false
    })
    expect("provider" in result.body).toBe(false)
    expect(transactions[0]?.provider).toBe("DING")
    expect(listSoutraliOrders()[0]?.status).toBe("completed")
    expect(listExecutionTelemetry("trace-soutrali-1").map((event) => event.type)).toContain("purchase.completed")
    expect(sendPurchaseConfirmationSms).toHaveBeenCalledWith(expect.objectContaining({
      reference: "SOUTRALI-TEST-1",
      productLabel: "Soutrali ORANGE CI Unités",
      amount: 5000,
      currency: "XOF",
      senderName: "Kipre",
      rechargeCode: undefined,
    }))
    const confirmationCalls = sendPurchaseConfirmationSms.mock.calls as unknown as Array<[
      { recipientPhoneCandidates?: Array<string | undefined> }
    ]>
    const confirmationInput = confirmationCalls[0]?.[0]
    expect(confirmationInput?.recipientPhoneCandidates).toContain("+2250700000000")
  })
})