import { getDefaultManualBillingSmsRoutingPolicy, parseManualBillingSmsRoutingPolicy } from "@/app/lib/internalSettings"

describe("manual billing internal settings", () => {
  it("keeps TPECloud out of the default routing order until the provider is implemented", () => {
    const policy = getDefaultManualBillingSmsRoutingPolicy()

    expect(policy.confirmation["moov-ci"]).toEqual(["twilio", "africasTalking", "orange", "mtn"])
    expect(policy.confirmation["moov-ci"]).not.toContain("tpeCloud")
  })

  it("accepts tpeCloud as a valid provider in a custom routing policy", () => {
    const parsed = parseManualBillingSmsRoutingPolicy({
      confirmation: {
        "moov-ci": ["tpeCloud", "twilio", "africasTalking"],
      },
    })

    expect(parsed?.confirmation["moov-ci"]).toEqual(["tpeCloud", "twilio", "africasTalking"])
  })
})