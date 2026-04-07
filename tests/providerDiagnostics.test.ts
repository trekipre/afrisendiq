import { summarizeDingCoverage, summarizeDtOneCoverage } from "@/app/lib/providerDiagnostics"

describe("provider diagnostics summaries", () => {
  it("summarizes Ding Côte d'Ivoire coverage from provider and product lists", () => {
    const summary = summarizeDingCoverage(
      [
        { ProviderCode: "HQCI", CountryIso: "CI", Name: "Jumia Ivory Coast" },
        { ProviderCode: "CIECI", CountryIso: "CI", Name: "CIE Ivory Coast" },
        { ProviderCode: "35CI", CountryIso: "CI", Name: "Moov Ivory Coast Data" }
      ],
      [
        { ProviderCode: "HQCI", SkuCode: "HQ1", LocalizationKey: "HQ1", SettingDefinitions: [], Maximum: { CustomerFee: 0, DistributorFee: 0, ReceiveValue: 1000, ReceiveCurrencyIso: "XOF", SendValue: 2, SendCurrencyIso: "USD" }, Minimum: { CustomerFee: 0, DistributorFee: 0, ReceiveValue: 1000, ReceiveCurrencyIso: "XOF", SendValue: 2, SendCurrencyIso: "USD" }, CommissionRate: 0, ProcessingMode: "Instant", RedemptionMechanism: "Immediate", Benefits: ["Utility"], LookupBillsRequired: true },
        { ProviderCode: "35CI", SkuCode: "35CI1", LocalizationKey: "35CI1", SettingDefinitions: [], Maximum: { CustomerFee: 0, DistributorFee: 0, ReceiveValue: 200, ReceiveCurrencyIso: "XOF", SendValue: 1, SendCurrencyIso: "USD" }, Minimum: { CustomerFee: 0, DistributorFee: 0, ReceiveValue: 200, ReceiveCurrencyIso: "XOF", SendValue: 1, SendCurrencyIso: "USD" }, CommissionRate: 0, ProcessingMode: "Instant", RedemptionMechanism: "Immediate", Benefits: ["Mobile", "Data"], LookupBillsRequired: false }
      ]
    )

    expect(summary.countryIso).toBe("CI")
    expect(summary.providerCount).toBe(3)
    expect(summary.productCount).toBe(2)
    expect(summary.categories).toEqual(["Data", "Mobile", "Utility"])
    expect(summary.highlights).toEqual(["CIE Ivory Coast", "Jumia Ivory Coast", "Moov Ivory Coast Data"])
  })

  it("summarizes DT One Côte d'Ivoire coverage from live product payloads", () => {
    const summary = summarizeDtOneCoverage([
      {
        name: "Electricidad prepaga de CIE en Costa de Marfil",
        operator: { name: "CIE Ivory Coast" },
        service: { name: "Utilities" }
      },
      {
        name: "Orange Ivory Coast Data",
        operator: { name: "Orange Ivory Coast" },
        service: { name: "Mobile" }
      }
    ])

    expect(summary.countryIso).toBe("CI")
    expect(summary.providerCount).toBe(2)
    expect(summary.productCount).toBe(2)
    expect(summary.categories).toEqual(["Mobile", "Utilities"])
    expect(summary.highlights).toEqual(["CIE Ivory Coast", "Orange Ivory Coast"])
  })
})