import Image from "next/image"
import Link from "next/link"

type AfriSendIQBrandProps = {
  variant?: "hero" | "compact"
  className?: string
}

export function AfriSendIQBrand({
  variant = "compact",
  className = ""
}: AfriSendIQBrandProps) {
  const isHero = variant === "hero"
  const width = isHero ? 192 : 116
  const height = isHero ? 128 : 78

  return (
    <Link
      href="/"
      className={[
        "inline-flex items-center gap-4 rounded-3xl border border-white/12 bg-white/8 px-4 py-3 text-white shadow-[0_24px_80px_rgba(3,12,9,0.22)] backdrop-blur",
        isHero ? "pr-6" : "pr-4",
        className
      ].join(" ")}
    >
      <div className="rounded-2xl bg-white/96 p-2 shadow-inner shadow-black/5">
        <Image
          src={isHero ? "/logos/afrisendiq-logo-320.png" : "/logos/afrisendiq-logo-160.png"}
          alt="AfriSendIQ"
          width={width}
          height={height}
          priority={isHero}
          className="h-auto w-auto"
        />
      </div>

      <div className="max-w-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/90">
          Send Smiles Across Africa
        </div>
        <div className={isHero ? "mt-1 text-2xl font-semibold" : "mt-1 text-lg font-semibold"}>
          AfriSendIQ
        </div>
        <p className="mt-1 text-sm leading-6 text-emerald-50/78">
          Airtime, data, electricity, and gift cards — delivered to Côte d&apos;Ivoire.
        </p>
      </div>
    </Link>
  )
}