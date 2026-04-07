import { resolveCatalogCheckoutSuccess } from "@/app/lib/catalogCheckoutSuccess"

describe("catalog checkout success resolution", () => {
  it("builds a customer-facing completion state for automated catalog products", () => {
    const result = resolveCatalogCheckoutSuccess({
      product: {
        name: "Soutrali Orange CI Unités",
        category: "airtime",
        currency: "XOF",
        customerReferenceLabel: "Recipient phone",
        recipientLabel: "Recipient phone",
        serviceLogoPath: "/service-cards/ORANGE CI CREDITS.png",
      },
      payload: {
        reference: "SOUTRALI-TEST-ORANGE-1",
        product: {
          name: "Soutrali Orange CI Unités",
        },
        transaction: {
          status: "COMPLETED",
          completedAt: "2026-03-29T12:20:00.000Z",
        },
      },
      fallbackReference: "Transaction créée",
      amount: 5000,
      customerReference: "+2250700000000",
      recipientValue: "+2250700000000",
      usesSharedContactField: true,
    })

    expect(result).toEqual({
      type: "show-completion",
      completion: {
        kind: "airtime",
        reference: "SOUTRALI-TEST-ORANGE-1",
        productName: "Soutrali Orange CI Unités",
        amount: 5000,
        currency: "XOF",
        customerReference: "+2250700000000",
        customerReferenceLabel: "Recipient phone",
        recipientValue: "+2250700000000",
        recipientLabel: "Recipient phone",
        usesSharedContactField: true,
        rechargeCode: undefined,
        completedAt: "2026-03-29T12:20:00.000Z",
        logoSrc: "/service-cards/ORANGE CI CREDITS.png",
      },
    })
  })

  it("builds a customer-facing completion state for non-electricity products", () => {
    const result = resolveCatalogCheckoutSuccess({
      product: {
        name: "Soutrali JUMIA CI Gift Card",
        category: "gift-card",
        currency: "XOF",
        customerReferenceLabel: "Email ou téléphone du bénéficiaire",
        recipientLabel: "Nom du bénéficiaire",
        serviceLogoPath: "/service-cards/JUMIA CI.png",
      },
      payload: {
        reference: "SOUTRALI-TEST-JUMIA-1",
        product: {
          name: "Soutrali JUMIA CI Gift Card",
        },
        transaction: {
          rechargeCode: "JCI-5519-0272-3111",
          completedAt: "2026-03-29T12:21:00.000Z",
        },
      },
      fallbackReference: "Transaction créée",
      amount: 10000,
      customerReference: "famille@example.com",
      recipientValue: "Essecoffy Rachelle",
      usesSharedContactField: false,
    })

    expect(result).toEqual({
      type: "show-completion",
      completion: {
        kind: "gift-card",
        reference: "SOUTRALI-TEST-JUMIA-1",
        productName: "Soutrali JUMIA CI Gift Card",
        amount: 10000,
        currency: "XOF",
        customerReference: "famille@example.com",
        customerReferenceLabel: "Email ou téléphone du bénéficiaire",
        recipientValue: "Essecoffy Rachelle",
        recipientLabel: "Nom du bénéficiaire",
        usesSharedContactField: false,
        rechargeCode: "JCI-5519-0272-3111",
        completedAt: "2026-03-29T12:21:00.000Z",
        logoSrc: "/service-cards/JUMIA CI.png",
      },
    })
  })
})