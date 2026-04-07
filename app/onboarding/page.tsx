import type { Metadata } from "next"
import { OnboardingFlow } from "@/app/components/OnboardingFlow"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://afrisendiq.com"

export const metadata: Metadata = {
  title: "Customer Onboarding",
  description:
    "Explore the Afrisendiq onboarding flow for progressive verification, address detection, and passkey-first account security.",
  alternates: {
    canonical: `${SITE_URL}/onboarding`,
  },
}

export default function OnboardingPage() {
  return <OnboardingFlow />
}