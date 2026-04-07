function readPercent(key: string, fallback: number) {
  const parsed = Number(process.env[key])
  return Number.isFinite(parsed) ? parsed : fallback
}

function getRiskTier(providerId?: string) {
  if (!providerId) {
    return "medium"
  }

  return String(process.env[`PROFIT_PROVIDER_RISK_TIER_${providerId.toUpperCase()}`] || "medium").toLowerCase()
}

function getRiskPremium(providerId?: string) {
  const tier = getRiskTier(providerId)

  if (tier === "high") {
    return readPercent("PROFIT_RISK_PREMIUM_HIGH_PCT", 1.5)
  }

  if (tier === "low") {
    return readPercent("PROFIT_RISK_PREMIUM_LOW_PCT", 0)
  }

  return readPercent("PROFIT_RISK_PREMIUM_MEDIUM_PCT", 0.5)
}

export function getMarginPercent(providerId?: string) {
  const baseMargin = providerId
    ? readPercent(`PROFIT_MIN_MARGIN_PCT_${providerId.toUpperCase()}`, Number.NaN)
    : Number.NaN

  const defaultMargin = readPercent("PROFIT_MIN_MARGIN_PCT", 12)
  const marginFloor = Number.isFinite(baseMargin) ? baseMargin : defaultMargin
  return marginFloor + getRiskPremium(providerId)
}

/**
 * Static pricing function — used for catalog display and quick estimates.
 * For real-time transaction pricing, use computeOptimalPrice() from profitEngine.ts.
 */
export function calculatePrice(providerCost: number, providerId?: string) {
  const marginPercent = getMarginPercent(providerId)
  const netPrice = providerCost * (1 + marginPercent / 100)

  // Enforce minimum absolute margin
  const minAbsolute = readPercent("PROFIT_MIN_ABSOLUTE_XOF", 150)
  const adjustedNet = Math.max(netPrice, providerCost + minAbsolute)

  const stripeFeePercent = readPercent("STRIPE_FEE_PERCENT", 2.9) / 100
  const stripeFeeFixed = readPercent("STRIPE_FEE_FIXED", 0)
  // Gross-up: customer pays enough so that after Stripe's cut, AfriSendIQ keeps netPrice
  const price = (adjustedNet + stripeFeeFixed) / (1 - stripeFeePercent)
  return Math.round(price * 100) / 100
}