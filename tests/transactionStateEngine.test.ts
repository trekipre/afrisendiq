import {
  runTransactionGuards,
  updateLiquidity,
  resetTransactionGuards,
  getAuditLog,
  getLiquidity,
  reserveLiquidity,
  releaseLiquidity,
  settleLiquidity,
  getLiquidityReservations,
  withRetry,
  type TransactionGuardConfig
} from "@/app/lib/transactionStateEngine"

const baseInput = {
  traceId: "trace-001",
  productId: "airtime-1000",
  customerReference: "+22500000001",
  amount: 5000,
  currency: "XOF",
  provider: "reloadly"
}

describe("Transaction State Engine", () => {
  beforeEach(() => {
    resetTransactionGuards()
  })

  it("approves a valid first transaction", async () => {
    const result = await runTransactionGuards(baseInput)

    expect(result.approved).toBe(true)
    expect(result.verdicts.every((v) => v.passed)).toBe(true)
    expect(result.blockedBy).toBeUndefined()
  })

  it("blocks duplicate transactions via idempotency", async () => {
    await runTransactionGuards(baseInput)
    const dup = await runTransactionGuards({ ...baseInput, traceId: "trace-002" })

    expect(dup.approved).toBe(false)
    expect(dup.blockedBy).toBe("idempotency")
  })

  it("blocks transactions below minimum amount", async () => {
    const result = await runTransactionGuards({ ...baseInput, amount: 10 })

    expect(result.approved).toBe(false)
    expect(result.blockedBy).toBe("transaction_limits")
  })

  it("blocks transactions above maximum amount", async () => {
    const result = await runTransactionGuards({ ...baseInput, amount: 999999 })

    expect(result.approved).toBe(false)
    expect(result.blockedBy).toBe("transaction_limits")
  })

  it("enforces per-user daily velocity limit", async () => {
    const config: Partial<TransactionGuardConfig> = {
      maxDailyTransactionsPerUser: 2,
      idempotencyWindowMs: 0 // disable idempotency for this test
    }

    // Build unique inputs to avoid idempotency blocks
    await runTransactionGuards({ ...baseInput, amount: 1000, productId: "p1" }, config)
    await runTransactionGuards({ ...baseInput, amount: 2000, productId: "p2" }, config)

    const third = await runTransactionGuards({ ...baseInput, amount: 3000, productId: "p3" }, config)

    expect(third.approved).toBe(false)
    expect(third.blockedBy).toBe("velocity_count")
  })

  it("enforces rate limit per customer", async () => {
    const config: Partial<TransactionGuardConfig> = {
      rateLimitMaxRequests: 2,
      rateLimitWindowMs: 60000,
      idempotencyWindowMs: 0
    }

    await runTransactionGuards({ ...baseInput, productId: "a", amount: 100 }, config)
    await runTransactionGuards({ ...baseInput, productId: "b", amount: 200 }, config)

    const third = await runTransactionGuards({ ...baseInput, productId: "c", amount: 300 }, config)

    expect(third.approved).toBe(false)
    expect(third.blockedBy).toBe("rate_limit")
  })

  it("blocks when provider liquidity is below threshold", async () => {
    updateLiquidity("reloadly", 1000, "XOF", 800)

    const result = await runTransactionGuards({ ...baseInput, amount: 500 })

    // balance 1000 - amount 500 = 500, which is below threshold 800
    expect(result.approved).toBe(false)
    expect(result.blockedBy).toBe("liquidity")
  })

  it("allows when provider has sufficient liquidity", async () => {
    updateLiquidity("reloadly", 100000, "XOF", 5000)

    const result = await runTransactionGuards(baseInput)

    expect(result.approved).toBe(true)
  })

  it("passes when no liquidity data exists (JIT mode)", async () => {
    const result = await runTransactionGuards(baseInput)

    const liquidityVerdict = result.verdicts.find((v) => v.guard === "liquidity")
    expect(liquidityVerdict?.passed).toBe(true)
  })

  it("blocks when existing reservations would breach the liquidity threshold", async () => {
    updateLiquidity("reloadly", 10000, "XOF", 2000)
    reserveLiquidity("trace-a", "reloadly", 7000, "XOF")

    const result = await runTransactionGuards({ ...baseInput, amount: 1500, providerCost: 1500 })

    expect(result.approved).toBe(false)
    expect(result.blockedBy).toBe("liquidity")
  })

  it("reserves, releases, and settles provider liquidity", () => {
    updateLiquidity("reloadly", 10000, "XOF", 1000)

    const reserved = reserveLiquidity("trace-a", "reloadly", 2500, "XOF")
    expect(reserved.reserved).toBe(true)
    expect(getLiquidityReservations("reloadly")).toHaveLength(1)

    expect(releaseLiquidity("trace-a")).toBe(true)
    expect(getLiquidityReservations("reloadly")).toHaveLength(0)

    reserveLiquidity("trace-b", "reloadly", 3000, "XOF")
    expect(settleLiquidity("trace-b")).toBe(true)
    expect(getLiquidity("reloadly")?.balance).toBe(7000)
    expect(getLiquidityReservations("reloadly")).toHaveLength(0)
  })

  it("records every guard verdict in the audit log", async () => {
    await runTransactionGuards(baseInput)

    const audit = getAuditLog()
    expect(audit.length).toBeGreaterThanOrEqual(6) // 6 guards run
    expect(audit.every((a) => a.traceId === "trace-001")).toBe(true)
  })

  it("tracks global daily limit", async () => {
    const config: Partial<TransactionGuardConfig> = {
      globalDailyTransactionLimit: 2,
      idempotencyWindowMs: 0
    }

    await runTransactionGuards({ ...baseInput, productId: "g1", amount: 100 }, config)
    await runTransactionGuards({ ...baseInput, productId: "g2", amount: 200 }, config)

    const third = await runTransactionGuards({ ...baseInput, productId: "g3", amount: 300 }, config)
    expect(third.approved).toBe(false)
    expect(third.blockedBy).toBe("global_daily_limit")
  })

  describe("withRetry", () => {
    it("retries transient failures", async () => {
      let attempt = 0
      const result = await withRetry(async () => {
        attempt++
        if (attempt < 3) throw new Error("transient")
        return "success"
      }, { retryBaseDelayMs: 10 })

      expect(result).toBe("success")
      expect(attempt).toBe(3)
    })

    it("does not retry business logic errors", async () => {
      await expect(
        withRetry(async () => {
          throw new Error("Duplicate transaction blocked")
        }, { retryBaseDelayMs: 10 })
      ).rejects.toThrow("blocked")
    })
  })
})
