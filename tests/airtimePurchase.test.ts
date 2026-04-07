import { processAirtimePurchase } from "@/app/lib/airtimePurchase"
import { listExecutionTelemetry, resetExecutionTelemetry } from "@/app/lib/executionTelemetry"
import { resetTransactions, transactions } from "@/app/lib/ledger"
import { listAirtimeOrders, resetAirtimeOrders } from "@/app/lib/orderState"

describe("airtime purchase flow", () => {
  beforeEach(() => {
    resetExecutionTelemetry()
    resetTransactions()
    resetAirtimeOrders()
  })

  it("processes a successful purchase and records telemetry and order state", async () => {
    const sendPurchaseConfirmationSms = vi.fn(async () => ({
      delivered: true as const,
      to: "+2250700000000",
      sid: "SM_AIRTIME_CONFIRM",
      whatsappSid: "WA_AIRTIME_CONFIRM",
      body: "AfriSendIQ purchase confirmed.",
    }))

    const result = await processAirtimePurchase(
      {
        phone: "+2250700000000",
        amount: 5000,
        senderName: "Kipre",
      },
      {
        createReference: () => "AFRISEND-TEST-1",
        createTraceId: () => "trace-1",
        detectOperator: async () => ({
          operatorId: 42,
          name: "Orange CI"
        }),
        sendPurchaseConfirmationSms,
        executeAirtimeWithFallback: async () => ({
          provider: "reloadly",
          status: "submitted",
          transaction: {
            status: "submitted",
            transactionId: "tx-1"
          },
          attempts: [
            {
              provider: "reloadly",
              success: true,
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString()
            }
          ]
        })
      }
    )

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(result.body.traceId).toBe("trace-1")
    expect(typeof result.body.quotedPrice).toBe("number")
    expect(Number(result.body.quotedPrice)).toBeGreaterThan(5000)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].provider).toBe("RELOADLY")
    expect(transactions[0].quotedPrice).toBe(Number(result.body.quotedPrice))
    expect(listAirtimeOrders()[0]?.status).toBe("submitted")
    expect(listExecutionTelemetry("trace-1").map((event) => event.type)).toContain("purchase.completed")
    expect(sendPurchaseConfirmationSms).toHaveBeenCalledWith({
      reference: "AFRISEND-TEST-1",
      productLabel: "Orange CI airtime",
      productCategory: "airtime",
      amount: 5000,
      currency: "XOF",
      recipientPhoneCandidates: ["+2250700000000"],
      senderName: "Kipre",
    })
  })

  it("returns a validation error when no phone is provided", async () => {
    const result = await processAirtimePurchase({ amount: 5000 })

    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      success: false,
      error: "Phone is required"
    })
  })

  it("fails cleanly when operator detection cannot resolve a carrier", async () => {
    const result = await processAirtimePurchase(
      {
        phone: "+225000",
        amount: 5000
      },
      {
        createReference: () => "AFRISEND-TEST-2",
        createTraceId: () => "trace-2",
        detectOperator: async () => ({})
      }
    )

    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      success: false,
      error: "Operator not found",
      traceId: "trace-2"
    })
    expect(listAirtimeOrders()[0]?.status).toBe("failed")
  })

  it("surfaces provider execution errors after recording failure telemetry", async () => {
    const sendPurchaseConfirmationSms = vi.fn()

    const result = await processAirtimePurchase(
      {
        phone: "+2250700000000",
        amount: 5000
      },
      {
        createReference: () => "AFRISEND-TEST-3",
        createTraceId: () => "trace-3",
        detectOperator: async () => ({
          operatorId: 42,
          name: "Orange CI"
        }),
        sendPurchaseConfirmationSms,
        executeAirtimeWithFallback: async () => {
          throw new Error("Reloadly timed out")
        }
      }
    )

    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      success: false,
      error: "Reloadly timed out"
    })
    expect(listAirtimeOrders()[0]?.status).toBe("failed")
    expect(listExecutionTelemetry("trace-3").map((event) => event.type)).toContain("purchase.failed")
    expect(sendPurchaseConfirmationSms).not.toHaveBeenCalled()
  })
})