export type AuthPreference = "passkey" | "email_magic_link" | "sms_otp"

export type OnboardingDraftInput = {
  id?: string
  status?: "draft" | "submitted" | "under_review" | "approved" | "rejected"
  currentStep: number
  email: string
  phone: string
  legalFirstName: string
  legalLastName: string
  countryOfResidence: string
  dateOfBirth: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  authPreference: AuthPreference
  enableTrustedDevice: boolean
}

export type VerificationTier = "starter" | "standard" | "enhanced_due_diligence"
export type RiskLevel = "low" | "medium" | "high"

export type OnboardingDecision = {
  verificationTier: VerificationTier
  riskLevel: RiskLevel
  riskScore: number
  requiresStepUp: boolean
  requiresManualReview: boolean
  status: "approved" | "needs_more_info" | "under_review" | "blocked"
  stepUpReason?: string
  recommendedLimits: {
    currency: "USD"
    perTransaction: number
    dailyAmount: number
    monthlyAmount: number
  }
  caseReason?: string
}

const preferredCorridorCountries = new Set([
  "united states",
  "canada",
  "united kingdom",
  "france",
  "germany",
])

function calculateAge(dateOfBirth: string) {
  if (!dateOfBirth) {
    return null
  }

  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1
  }

  return age
}

function isMissingCoreIdentity(input: OnboardingDraftInput) {
  return !input.email || !input.phone || !input.legalFirstName || !input.legalLastName
}

function isMissingAddress(input: OnboardingDraftInput) {
  return !input.addressLine1 || !input.city || !input.region || !input.postalCode || !input.countryCode
}

export function evaluateOnboardingDraft(input: OnboardingDraftInput): OnboardingDecision {
  const normalizedCountry = input.countryOfResidence.trim().toLowerCase()
  const age = calculateAge(input.dateOfBirth)
  const missingCoreIdentity = isMissingCoreIdentity(input)
  const missingAddress = isMissingAddress(input)

  let riskScore = 0
  let requiresStepUp = false
  let requiresManualReview = false
  let stepUpReason: string | undefined
  let caseReason: string | undefined
  let status: OnboardingDecision["status"] = "approved"

  if (missingCoreIdentity) {
    riskScore += 25
  }

  if (!input.dateOfBirth) {
    riskScore += 20
  }

  if (missingAddress) {
    riskScore += 20
  }

  if (input.authPreference === "sms_otp") {
    riskScore += 10
  }

  if (!preferredCorridorCountries.has(normalizedCountry)) {
    riskScore += 25
    requiresStepUp = true
    requiresManualReview = true
    stepUpReason = "Country of residence requires enhanced partner review"
    caseReason = "Enhanced due diligence triggered by country of residence"
  }

  if (age === null) {
    requiresStepUp = true
    stepUpReason = stepUpReason ?? "Date of birth is required before regulated activity"
    status = "needs_more_info"
  } else if (age < 18) {
    riskScore = 100
    requiresStepUp = true
    requiresManualReview = true
    stepUpReason = "Customer must be at least 18 years old"
    caseReason = "Underage onboarding attempt"
    status = "blocked"
  } else if (age < 21) {
    riskScore += 15
  }

  if (missingAddress || missingCoreIdentity) {
    requiresStepUp = true
    stepUpReason = stepUpReason ?? "Profile is incomplete for compliance review"
    status = status === "blocked" ? status : "needs_more_info"
  }

  if (riskScore >= 60 && status !== "blocked") {
    requiresManualReview = true
    requiresStepUp = true
    status = "under_review"
    stepUpReason = stepUpReason ?? "Manual review is required before higher-risk activity"
    caseReason = caseReason ?? "Onboarding risk score exceeded manual-review threshold"
  }

  let verificationTier: VerificationTier = "standard"
  let recommendedLimits = {
    currency: "USD" as const,
    perTransaction: 500,
    dailyAmount: 2000,
    monthlyAmount: 5000,
  }

  if (status === "blocked") {
    verificationTier = "enhanced_due_diligence"
    recommendedLimits = {
      currency: "USD",
      perTransaction: 0,
      dailyAmount: 0,
      monthlyAmount: 0,
    }
  } else if (requiresManualReview) {
    verificationTier = "enhanced_due_diligence"
    recommendedLimits = {
      currency: "USD",
      perTransaction: 250,
      dailyAmount: 500,
      monthlyAmount: 1000,
    }
  } else if (requiresStepUp) {
    verificationTier = "starter"
    recommendedLimits = {
      currency: "USD",
      perTransaction: 250,
      dailyAmount: 750,
      monthlyAmount: 2000,
    }
  }

  const riskLevel: RiskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low"

  return {
    verificationTier,
    riskLevel,
    riskScore,
    requiresStepUp,
    requiresManualReview,
    status,
    stepUpReason,
    recommendedLimits,
    caseReason,
  }
}