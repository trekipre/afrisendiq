import Image from "next/image"

type CoteDIvoireServiceLogoProps = {
  src?: string
  alt: string
  className?: string
  imageClassName?: string
}

const FALLBACK_LOGO = "/logos/afrisendiq-logo-96.png"

export function CoteDIvoireServiceLogo({
  src,
  alt,
  className = "",
  imageClassName = "h-full w-full object-contain"
}: CoteDIvoireServiceLogoProps) {
  const imageSrc = src || FALLBACK_LOGO

  return (
    <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100/70 bg-white p-2 shadow-sm ${className}`.trim()}>
      <Image
        src={imageSrc}
        alt={alt}
        width={96}
        height={96}
        className={imageClassName}
      />
    </div>
  )
}