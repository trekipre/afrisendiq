"use client"

import { useEffect, useMemo, useState } from "react"
import { AfriSendIQBrand } from "@/app/components/AfriSendIQBrand"

type AddressSuggestion = {
  label: string
  line1: string
  city: string
  region: string
  postalCode: string
  countryCode: string
  latitude?: number
  longitude?: number
}

type OnboardingForm = {
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
  authPreference: "passkey" | "email_magic_link" | "sms_otp"
  enableTrustedDevice: boolean
}

type OnboardingDecision = {
  verificationTier: "starter" | "standard" | "enhanced_due_diligence"
  riskLevel: "low" | "medium" | "high"
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
}

type PersistedDraftResponse = {
  draft: {
    id: string
    status: "draft" | "submitted" | "under_review" | "approved" | "rejected"
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
    authPreference: OnboardingForm["authPreference"]
    enableTrustedDevice: boolean
  }
  decision: OnboardingDecision
  caseId?: string
  caseStatus?: string
}

const steps = [
  { id: "account", label: "Account" },
  { id: "contact", label: "Contact" },
  { id: "identity", label: "Identity" },
  { id: "address", label: "Address" },
  { id: "security", label: "Security" },
  { id: "review", label: "Review" },
] as const

const initialForm: OnboardingForm = {
  email: "",
  phone: "",
  legalFirstName: "",
  legalLastName: "",
  countryOfResidence: "United States",
  dateOfBirth: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  authPreference: "passkey",
  enableTrustedDevice: true,
}

function StepBadge({ active, complete, label }: { active: boolean; complete: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-emerald-50/82">
      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
          complete ? "bg-emerald-200 text-emerald-950" : active ? "bg-white text-[#0E2E23]" : "bg-white/10 text-emerald-50/70",
        ].join(" ")}
      >
        {complete ? "OK" : label.slice(0, 1)}
      </span>
      <span>{label}</span>
    </div>
  )
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<OnboardingForm>(initialForm)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [decision, setDecision] = useState<OnboardingDecision | null>(null)
  const [caseStatus, setCaseStatus] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "submitted" | "error">("idle")
  const [draftReady, setDraftReady] = useState(false)
  const [addressQuery, setAddressQuery] = useState("")
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [detectingAddress, setDetectingAddress] = useState(false)

  const completionScore = useMemo(() => {
    const completedFields = [
      form.email,
      form.phone,
      form.legalFirstName,
      form.legalLastName,
      form.countryOfResidence,
      form.dateOfBirth,
      form.addressLine1,
      form.city,
      form.region,
      form.postalCode,
    ].filter(Boolean).length

    return Math.round((completedFields / 10) * 100)
  }, [form])

  useEffect(() => {
    let cancelled = false

    async function loadDraft() {
      const storedDraftId = window.localStorage.getItem("afrisendiq-onboarding-draft-id")
      if (!storedDraftId) {
        setDraftReady(true)
        return
      }

      try {
        const response = await fetch(`/api/onboarding/draft?draftId=${encodeURIComponent(storedDraftId)}`)
        if (!response.ok) {
          window.localStorage.removeItem("afrisendiq-onboarding-draft-id")
          setDraftReady(true)
          return
        }

        const payload = (await response.json()) as PersistedDraftResponse
        if (cancelled) {
          return
        }

        setDraftId(payload.draft.id)
        setCurrentStep(payload.draft.currentStep)
        setForm({
          email: payload.draft.email,
          phone: payload.draft.phone,
          legalFirstName: payload.draft.legalFirstName,
          legalLastName: payload.draft.legalLastName,
          countryOfResidence: payload.draft.countryOfResidence,
          dateOfBirth: payload.draft.dateOfBirth,
          addressLine1: payload.draft.addressLine1,
          addressLine2: payload.draft.addressLine2,
          city: payload.draft.city,
          region: payload.draft.region,
          postalCode: payload.draft.postalCode,
          countryCode: payload.draft.countryCode,
          authPreference: payload.draft.authPreference,
          enableTrustedDevice: payload.draft.enableTrustedDevice,
        })
        setDecision(payload.decision)
        setCaseStatus(payload.caseStatus ?? null)
        setSaveState("saved")
      } finally {
        if (!cancelled) {
          setDraftReady(true)
        }
      }
    }

    void loadDraft()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftReady) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveState("saving")
        const response = await fetch("/api/onboarding/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: draftId,
            currentStep,
            ...form,
          }),
        })

        const payload = (await response.json()) as PersistedDraftResponse | { error?: string }
        if (!response.ok || !("draft" in payload)) {
          throw new Error((payload as { error?: string }).error || "Unable to save onboarding draft")
        }

        setDraftId(payload.draft.id)
        window.localStorage.setItem("afrisendiq-onboarding-draft-id", payload.draft.id)
        setDecision(payload.decision)
        setCaseStatus(payload.caseStatus ?? null)
        setSaveState("saved")
      } catch {
        setSaveState("error")
      }
    }, 650)

    return () => window.clearTimeout(timeoutId)
  }, [draftId, draftReady, currentStep, form])

  useEffect(() => {
    if (currentStep !== 3 || addressQuery.trim().length < 4) {
      setAddressSuggestions([])
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setAddressLoading(true)
        setAddressError(null)

        const params = new URLSearchParams({ q: addressQuery, countryCode: form.countryCode || "US" })
        const response = await fetch(`/api/onboarding/address-search?${params.toString()}`)
        const payload = (await response.json()) as { suggestions?: AddressSuggestion[]; error?: string }

        if (!response.ok) {
          throw new Error(payload.error || "Unable to search addresses right now")
        }

        setAddressSuggestions(payload.suggestions || [])
      } catch (error) {
        setAddressError(error instanceof Error ? error.message : "Unable to search addresses right now")
      } finally {
        setAddressLoading(false)
      }
    }, 280)

    return () => window.clearTimeout(timeoutId)
  }, [addressQuery, currentStep, form.countryCode])

  function updateForm<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function applySuggestion(suggestion: AddressSuggestion) {
    setForm((current) => ({
      ...current,
      addressLine1: suggestion.line1,
      city: suggestion.city,
      region: suggestion.region,
      postalCode: suggestion.postalCode,
      countryCode: suggestion.countryCode,
    }))
    setAddressQuery(suggestion.label)
    setAddressSuggestions([])
  }

  async function detectCurrentAddress() {
    if (!("geolocation" in navigator)) {
      setAddressError("This browser does not support location-based address detection")
      return
    }

    setDetectingAddress(true)
    setAddressError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            lat: String(position.coords.latitude),
            lon: String(position.coords.longitude),
          })
          const response = await fetch(`/api/onboarding/address-reverse?${params.toString()}`)
          const payload = (await response.json()) as { suggestion?: AddressSuggestion; error?: string }

          if (!response.ok || !payload.suggestion) {
            throw new Error(payload.error || "Unable to detect your address")
          }

          applySuggestion(payload.suggestion)
        } catch (error) {
          setAddressError(error instanceof Error ? error.message : "Unable to detect your address")
        } finally {
          setDetectingAddress(false)
        }
      },
      (error) => {
        setAddressError(error.message || "Address detection was declined")
        setDetectingAddress(false)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    )
  }

  function nextStep() {
    setCurrentStep((value) => Math.min(value + 1, steps.length - 1))
  }

  function previousStep() {
    setCurrentStep((value) => Math.max(value - 1, 0))
  }

  async function submitDraft() {
    if (!draftId) {
      return
    }

    try {
      setSubmitState("submitting")
      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draftId }),
      })

      const payload = (await response.json()) as PersistedDraftResponse | { error?: string }
      if (!response.ok || !("draft" in payload)) {
        throw new Error((payload as { error?: string }).error || "Unable to submit onboarding draft")
      }

      setDraftId(payload.draft.id)
      setDecision(payload.decision)
      setCaseStatus(payload.caseStatus ?? null)
      setSubmitState("submitted")
    } catch {
      setSubmitState("error")
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1b6a4d_0%,#0d241c_38%,#081711_100%)] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <AfriSendIQBrand className="max-w-xl" />
          <div className="max-w-sm rounded-[1.5rem] border border-white/12 bg-white/10 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.14)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Why this flow is different</div>
            <p className="mt-3 text-sm leading-6 text-emerald-50/76">
              Afrisendiq uses progressive verification. You can explore first, then we only ask for the next piece of information when regulations, risk, or partner rules actually require it.
            </p>
            <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-xs text-emerald-50/80">
              Draft status: {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save issue" : "Idle"}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[2rem] border border-white/12 bg-white/10 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.18)] backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Onboarding</div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">Secure account setup without a bank-style interrogation.</h1>
            <p className="mt-4 text-sm leading-6 text-emerald-50/76">
              This flow is designed to support AML, KYC, CIP, sanctions screening, and stronger partner trust while staying as light as possible for low-risk customers.
            </p>

            <div className="mt-6 rounded-[1.5rem] bg-white/10 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-emerald-100/80">Completion</span>
                <span className="font-semibold">{completionScore}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-emerald-300 transition-all" style={{ width: `${completionScore}%` }} />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {steps.map((step, index) => (
                <StepBadge key={step.id} label={step.label} active={index === currentStep} complete={index < currentStep} />
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-emerald-300/14 bg-emerald-300/10 p-4 text-sm text-emerald-50/82">
              <div className="font-semibold text-white">Security defaults</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
                <li>Passkeys are the default sign-in recommendation.</li>
                <li>SMS is backup only, not the main permanent factor.</li>
                <li>Trusted devices reduce repeated prompts for low-risk sessions.</li>
              </ul>
            </div>

            {decision && (
              <div className="mt-6 rounded-[1.5rem] border border-sky-300/18 bg-sky-300/10 p-4 text-sm text-emerald-50/84">
                <div className="font-semibold text-white">Live compliance preview</div>
                <div className="mt-3 space-y-2 leading-6">
                  <div>Tier: <span className="font-semibold">{decision.verificationTier.replaceAll("_", " ")}</span></div>
                  <div>Risk: <span className="font-semibold">{decision.riskLevel}</span> ({decision.riskScore})</div>
                  <div>Status: <span className="font-semibold">{decision.status.replaceAll("_", " ")}</span></div>
                  <div>Step-up: <span className="font-semibold">{decision.requiresStepUp ? "Required" : "Not required yet"}</span></div>
                  {caseStatus && <div>Case: <span className="font-semibold">{caseStatus.replaceAll("_", " ")}</span></div>}
                </div>
              </div>
            )}
          </aside>

          <section className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-[0_24px_80px_rgba(6,14,11,0.18)] md:p-8">
            {currentStep === 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 1</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Create your secure Afrisendiq account</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Start with the least invasive fields. You will only be asked for more information when your transaction or compliance profile actually requires it.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Email address</div>
                    <input
                      value={form.email}
                      onChange={(event) => updateForm("email", event.target.value)}
                      className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400"
                      placeholder="you@example.com"
                      type="email"
                    />
                  </label>

                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Mobile number</div>
                    <input
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                      className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400"
                      placeholder="+1 555 000 0000"
                      type="tel"
                    />
                  </label>
                </div>

                <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-[#0F3D2E]">Recommended sign-in method</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {[
                      { value: "passkey", title: "Passkey", note: "Best for speed and phishing resistance." },
                      { value: "email_magic_link", title: "Magic link", note: "Good fallback if passkeys are not ready yet." },
                      { value: "sms_otp", title: "SMS backup", note: "Useful as recovery, but weaker than passkeys." },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateForm("authPreference", option.value as OnboardingForm["authPreference"])}
                        className={[
                          "rounded-[1.25rem] border px-4 py-4 text-left transition",
                          form.authPreference === option.value
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-slate-200 bg-white hover:border-emerald-300",
                        ].join(" ")}
                      >
                        <div className="font-semibold text-slate-900">{option.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{option.note}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 2</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Verify the contact points that protect your account</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 p-5">
                    <div className="text-sm font-semibold">Email verification</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Used for receipts, security notices, and low-friction login fallback.</p>
                    <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Draft address: {form.email || "Enter your email on the previous step."}</div>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 p-5">
                    <div className="text-sm font-semibold">Phone verification</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Used for account defense, suspicious login challenges, and step-up authentication when risk increases.</p>
                    <div className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">Draft number: {form.phone || "Enter your number on the previous step."}</div>
                  </div>
                </div>
                <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  Afrisendiq should send verification challenges from dedicated backend routes later. For now, this screen aligns the UX and required data model for that step-up flow.
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 3</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Personal details for AML, KYC, and customer identity</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">These are the core fields Afrisendiq should collect before regulated activity or higher-risk transactions. Keep this step precise and calm, not accusatory.</p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Legal first name</div>
                    <input value={form.legalFirstName} onChange={(event) => updateForm("legalFirstName", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Legal last name</div>
                    <input value={form.legalLastName} onChange={(event) => updateForm("legalLastName", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Country of residence</div>
                    <select value={form.countryOfResidence} onChange={(event) => updateForm("countryOfResidence", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400">
                      <option>United States</option>
                      <option>Canada</option>
                      <option>United Kingdom</option>
                      <option>France</option>
                      <option>Germany</option>
                    </select>
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Date of birth</div>
                    <input value={form.dateOfBirth} onChange={(event) => updateForm("dateOfBirth", event.target.value)} type="date" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 4</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Address entry that feels assisted, not tedious</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">Customers can search manually or use location-assisted detection to reduce typing. Manual edit remains available, which matters for compliance accuracy.</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={detectCurrentAddress} className="rounded-full bg-[#0F3D2E] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#15543f]">
                    {detectingAddress ? "Detecting address..." : "Use my current location"}
                  </button>
                  <div className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">Country code: {form.countryCode}</div>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-slate-200 p-4">
                  <div className="text-sm font-semibold">Search address</div>
                  <input
                    value={addressQuery}
                    onChange={(event) => setAddressQuery(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400"
                    placeholder="Start typing your street address"
                  />

                  {addressLoading && <div className="mt-3 text-sm text-slate-500">Looking up addresses...</div>}
                  {addressError && <div className="mt-3 text-sm text-red-600">{addressError}</div>}

                  {addressSuggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {addressSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.label}-${suggestion.postalCode}`}
                          type="button"
                          onClick={() => applySuggestion(suggestion)}
                          className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <div className="font-medium text-slate-900">{suggestion.label}</div>
                          <div className="mt-1 text-sm text-slate-600">{suggestion.city}, {suggestion.region} {suggestion.postalCode}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="rounded-[1.5rem] border border-slate-200 p-4 md:col-span-2">
                    <div className="text-sm font-semibold">Address line 1</div>
                    <input value={form.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4 md:col-span-2">
                    <div className="text-sm font-semibold">Address line 2</div>
                    <input value={form.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" placeholder="Apartment, suite, floor, optional" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">City</div>
                    <input value={form.city} onChange={(event) => updateForm("city", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">State or region</div>
                    <input value={form.region} onChange={(event) => updateForm("region", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Postal code</div>
                    <input value={form.postalCode} onChange={(event) => updateForm("postalCode", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400" />
                  </label>
                  <label className="rounded-[1.5rem] border border-slate-200 p-4">
                    <div className="text-sm font-semibold">Country code</div>
                    <input value={form.countryCode} onChange={(event) => updateForm("countryCode", event.target.value.toUpperCase())} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 uppercase outline-none transition focus:border-emerald-400" maxLength={2} />
                  </label>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 5</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Security and 2-factor choices</h2>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                    <div className="text-sm font-semibold text-emerald-950">Recommended: passkeys</div>
                    <p className="mt-2 text-sm leading-6 text-emerald-900">Fast login, phishing-resistant, and easier on customers than forcing repeated SMS codes.</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 p-5">
                    <div className="text-sm font-semibold">Trusted device setting</div>
                    <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
                      <input type="checkbox" checked={form.enableTrustedDevice} onChange={(event) => updateForm("enableTrustedDevice", event.target.checked)} />
                      Reduce repeated prompts on this device unless a high-risk action occurs
                    </label>
                  </div>
                </div>

                <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  Afrisendiq should apply step-up authentication on new devices, profile changes, beneficiary changes, suspicious geolocation shifts, and higher-value transactions. Internal admins should be stricter than customers.
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800/80">Step 6</div>
                <h2 className="mt-2 text-3xl font-semibold text-[#0F3D2E]">Review your onboarding profile</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">This summary is designed for a future persisted onboarding draft and later compliance decisioning.</p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {[
                    { title: "Identity", value: `${form.legalFirstName} ${form.legalLastName}`.trim() || "Not provided yet" },
                    { title: "Contact", value: `${form.email || "No email"} · ${form.phone || "No phone"}` },
                    { title: "Residence", value: `${form.countryOfResidence} · DOB ${form.dateOfBirth || "pending"}` },
                    { title: "Address", value: `${form.addressLine1 || "Address pending"}${form.city ? `, ${form.city}` : ""}${form.region ? `, ${form.region}` : ""} ${form.postalCode}` },
                    { title: "Authentication", value: form.authPreference.replaceAll("_", " ") },
                    { title: "Trusted device", value: form.enableTrustedDevice ? "Enabled" : "Disabled" },
                  ].map((item) => (
                    <div key={item.title} className="rounded-[1.5rem] border border-slate-200 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-800">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.5rem] border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-950">
                  This draft is now persisted server-side. The current backend returns a verification tier, recommended limits, and step-up or review status based on the profile you entered.
                </div>

                <div className="mt-6 text-sm text-slate-600">
                  The next backend phase should attach live sanctions results, vendor verification evidence, and authenticated customer identity records behind this same flow.
                </div>

                {decision && (
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-slate-200 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recommended limits</div>
                      <div className="mt-2 text-sm leading-7 text-slate-800">
                        {decision.recommendedLimits.currency} {decision.recommendedLimits.perTransaction} per transaction<br />
                        {decision.recommendedLimits.currency} {decision.recommendedLimits.dailyAmount} daily<br />
                        {decision.recommendedLimits.currency} {decision.recommendedLimits.monthlyAmount} monthly
                      </div>
                    </div>
                    <div className="rounded-[1.5rem] border border-slate-200 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Decision notes</div>
                      <div className="mt-2 text-sm leading-7 text-slate-800">
                        {decision.stepUpReason || "No step-up required yet for the current draft profile."}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={submitDraft}
                    disabled={!draftId || submitState === "submitting"}
                    className="rounded-full bg-[#0F3D2E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitState === "submitting" ? "Submitting" : "Submit for verification"}
                  </button>
                  <div className="text-sm text-slate-600">
                    {submitState === "submitted"
                      ? decision?.status === "approved"
                        ? "Draft approved and linked to the customer-creation path."
                        : "Draft submitted for review or additional information."
                      : submitState === "error"
                        ? "Submission failed."
                        : "Submission runs approval or review logic on the saved draft."}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
              <button type="button" onClick={previousStep} disabled={currentStep === 0} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50">
                Back
              </button>

              <div className="text-sm text-slate-500">Step {currentStep + 1} of {steps.length}</div>

              <button type="button" onClick={nextStep} disabled={currentStep === steps.length - 1} className="rounded-full bg-[#0F3D2E] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#15543f] disabled:cursor-not-allowed disabled:opacity-50">
                {currentStep === steps.length - 1 ? "Ready for persistence" : "Continue"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}