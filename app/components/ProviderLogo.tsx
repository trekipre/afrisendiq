"use client"

import Image from "next/image"
import { useState } from "react"

type ProviderLogoProps = {
  src?: string
  alt: string
}

const FALLBACK_LOGO = "/logos/afrisendiq-logo-96.png"

export function ProviderLogo({ src, alt }: ProviderLogoProps) {
  const [imageSrc, setImageSrc] = useState(src || FALLBACK_LOGO)

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-white shadow-sm">
      <Image
        src={imageSrc || FALLBACK_LOGO}
        alt={alt}
        width={40}
        height={40}
        className="h-auto max-h-10 w-auto object-contain"
        unoptimized={!imageSrc.startsWith("/")}
        onError={() => setImageSrc(FALLBACK_LOGO)}
      />
    </div>
  )
}