"use client"

import Image from "next/image"

type ProductBrandLabelProps = {
  brand: string
  className?: string
}

const brandAssetMap: Record<string, string> = {
  MTN: "/service-cards/MTN CI CREDITS.png",
  MOOV: "/service-cards/MOOV CI CREDITS.png",
  ORANGE: "/service-cards/ORANGE CI CREDITS.png",
  CIE: "/service-cards/CIE PREPAID.jpg",
  JUMIA: "/service-cards/JUMIA CI.png"
}

export function ProductBrandLabel({ brand, className = "" }: ProductBrandLabelProps) {
  const assetPath = brandAssetMap[brand.toUpperCase()]

  if (!assetPath) {
    return <span className={`rounded-full bg-slate-100 px-3 py-1 ${className}`}>{brand}</span>
  }

  return (
    <div className={`inline-flex items-center ${className}`.trim()}>
      <Image src={assetPath} alt={`${brand} label`} width={120} height={42} className="h-9 w-auto object-contain" />
    </div>
  )
}