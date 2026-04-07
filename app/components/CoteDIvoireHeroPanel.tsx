"use client";

import Image from "next/image";

type CoteDIvoireHeroPanelProps = {
  badge: string;
  gradientClass: string;
  imageSrcs?: readonly string[];
  imageAlt: string;
  contextLabel?: string;
  pills?: readonly string[];
  wordmark?: string;
  heightClassName?: string;
};

const stackedImageOffsets = [
  "left-0 top-8 -rotate-[10deg]",
  "left-1/2 top-0 -translate-x-1/2",
  "right-0 top-10 rotate-[10deg]"
];

export function CoteDIvoireHeroPanel({
  badge,
  gradientClass,
  imageSrcs = [],
  imageAlt,
  contextLabel,
  pills = [],
  wordmark = "Soutrali",
  heightClassName = "h-72"
}: CoteDIvoireHeroPanelProps) {
  const cardImages = imageSrcs.filter(Boolean).slice(0, 3);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${gradientClass} ${heightClassName}`}>
      <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/[0.08]" />
      <div className="absolute -bottom-12 -right-8 h-52 w-52 rounded-full bg-black/[0.06]" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="select-none text-[2.6rem] font-black uppercase tracking-widest text-white/[0.06]">{wordmark}</span>
      </div>

      <div className="absolute left-5 top-5 z-20 rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
        {badge}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between p-5">
        <div className={`${cardImages.length === 1 ? "mt-8 flex flex-1 items-center justify-center px-4 py-4" : "mt-8 flex-1 px-4 py-4"}`}>
          {cardImages.length === 1 ? (
            <Image
              src={cardImages[0]}
              alt={imageAlt}
              width={420}
              height={420}
              className="h-full w-auto max-w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.28)]"
            />
          ) : cardImages.length > 1 ? (
            <div className="relative h-full">
              {cardImages.map((src, index) => (
                <div
                  key={`${src}-${index}`}
                  className={`absolute w-[45%] max-w-[8.5rem] origin-bottom ${stackedImageOffsets[index] || stackedImageOffsets[1]}`}
                >
                  <Image
                    src={src}
                    alt={imageAlt}
                    width={280}
                    height={360}
                    className="h-auto w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.3)]"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          {contextLabel ? (
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/50">{contextLabel}</div>
          ) : null}
          {pills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pills.map((pill) => (
                <span key={pill} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {pill}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
