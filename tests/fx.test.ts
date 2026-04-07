import { convertUsdAmount, getUsdRates, resetUsdRatesCache, getFxSnapshot, getBestCorridor } from "@/app/lib/fx"

const mockFxRates = {
  base_code: "USD",
  rates: {
    XOF: 610,
    NGN: 1501,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36
  }
}

describe("fx helper", () => {
  beforeEach(() => {
    resetUsdRatesCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns live rates when the upstream request succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          base_code: "USD",
          rates: {
            XOF: 610,
            NGN: 1501
          }
        })
      })
    )

    const result = await getUsdRates()

    expect(result.source).toBe("live")
    expect(result.stale).toBe(false)
    expect(result.rates.XOF).toBe(610)
  })

  it("falls back to configured default rates when the upstream request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")))

    const result = await getUsdRates()

    expect(result.source).toBe("fallback")
    expect(result.stale).toBe(true)
    expect(result.rates.XOF).toBe(600)
  })

  it("converts a usd amount with the resolved rate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          base_code: "USD",
          rates: { XOF: 612 }
        })
      })
    )

    const conversion = await convertUsdAmount(10, "xof")

    expect(conversion.currencyCode).toBe("XOF")
    expect(conversion.rate).toBe(612)
    expect(conversion.converted).toBe(6120)
  })
})

describe("getFxSnapshot", () => {
  beforeEach(() => {
    resetUsdRatesCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns a snapshot compatible with ProfitEngine", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFxRates
      })
    )

    const snapshot = await getFxSnapshot("USD", "XOF")
    expect(snapshot.pair).toBe("USD_XOF")
    expect(snapshot.rate).toBe(610)
    expect(snapshot.source).toBe("live")
    expect(snapshot.fetchedAt).toBeTruthy()
  })

  it("throws for non-USD base currency", async () => {
    await expect(getFxSnapshot("EUR", "XOF")).rejects.toThrow("only supports USD")
  })
})

describe("getBestCorridor", () => {
  beforeEach(() => {
    resetUsdRatesCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("selects the corridor with the highest target rate per unit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFxRates
      })
    )

    // USD→XOF = 610 XOF per 1 USD
    // EUR→XOF = 610 / 0.92 ≈ 663 XOF per 1 EUR
    // EUR gives more XOF per unit of payment currency
    const best = await getBestCorridor(["USD", "EUR"], "XOF")

    expect(best).not.toBeNull()
    expect(best!.corridor).toBe("EUR_XOF")
    expect(best!.rate).toBeGreaterThan(610) // should be ~663
  })

  it("falls back to fallback rates when API returns empty rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ base_code: "USD", rates: {} })
      })
    )

    // FX module falls back to hardcoded XOF=600, so USD corridor resolves
    const result = await getBestCorridor(["USD"], "XOF")
    expect(result).not.toBeNull()
    expect(result!.rate).toBe(600) // fallback rate
    expect(result!.source).toBe("fallback")
  })

  it("handles a single corridor correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFxRates
      })
    )

    const result = await getBestCorridor(["USD"], "XOF")
    expect(result).not.toBeNull()
    expect(result!.corridor).toBe("USD_XOF")
    expect(result!.rate).toBe(610)
  })
})