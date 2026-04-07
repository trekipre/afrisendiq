"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

export type ServiceTheme = "airtime" | "data" | "electricity" | "gift-cards" | "catalog" | "water" | "tv";

type CoteDIvoireServiceCardProps = {
  title: string;
  description: string;
  eyebrow: string;
  theme?: ServiceTheme;
  href?: string;
  ctaLabel?: string;
  ctaSubLabel?: string;
  brands?: readonly string[];
  imageSrcs?: readonly string[];
  imageAlt?: string;
  footer?: ReactNode;
};

const themeGradient: Record<ServiceTheme, string> = {
  airtime: "from-[#FFD200] via-[#FFBA00] to-[#FF8C00]",
  data: "from-[#1E40AF] via-[#3B82F6] to-[#60A5FA]",
  electricity: "from-[#D97706] via-[#F59E0B] to-[#FCD34D]",
  water: "from-[#0F5B8D] via-[#1E81B0] to-[#89CFF0]",
  "gift-cards": "from-[#C2410C] via-[#EA580C] to-[#FB923C]",
  tv: "from-[#5B1A6E] via-[#8B3BAF] to-[#F97316]",
  catalog: "from-[#065F46] via-[#059669] to-[#34D399]",
};

export function CoteDIvoireServiceCard({
  title,
  description,
  eyebrow,
  theme = "catalog",
  href,
  ctaLabel = "Explore",
  ctaSubLabel = "Open service",
  brands = [],
  imageSrcs = [],
  imageAlt,
  footer,
}: CoteDIvoireServiceCardProps) {
  const gradient = themeGradient[theme];
  const cardImages = imageSrcs.filter(Boolean).slice(0, 3);
  const hasImages = cardImages.length > 0;
  const stackedImageOffsets = [
    "left-0 top-8 -rotate-[10deg]",
    "left-1/2 top-0 -translate-x-1/2",
    "right-0 top-10 rotate-[10deg]"
  ];

  const content = (
    <>
      <div className={`relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${gradient} p-5`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(0,0,0,0.12),transparent_34%)]" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.08]" />
        <div className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-black/[0.06]" />

        <div className="relative z-10 rounded-[1.3rem] border border-white/16 bg-white/[0.06] p-4 backdrop-blur-[1px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
            Soutrali · Côte d&apos;Ivoire
          </div>

          {hasImages ? (
            <div className={`relative mt-4 overflow-hidden rounded-[1.15rem] border border-white/14 bg-white/[0.08] ${cardImages.length === 1 ? "h-[15rem]" : "h-[16rem]"}`}>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_45%)]" />
              {cardImages.length === 1 ? (
                <div className="relative flex h-full items-center justify-center px-3 py-4">
                  <Image
                    src={cardImages[0]}
                    alt={imageAlt || title}
                    width={420}
                    height={420}
                    className="h-full w-auto max-w-full object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.28)]"
                  />
                </div>
              ) : (
                <div className="relative h-full px-4 py-5">
                  {cardImages.map((src, index) => (
                    <div
                      key={`${src}-${index}`}
                      className={`absolute w-[45%] max-w-[8.5rem] origin-bottom transition duration-200 group-hover:scale-[1.02] ${stackedImageOffsets[index] || stackedImageOffsets[1]}`}
                    >
                      <Image
                        src={src}
                        alt={imageAlt || title}
                        width={280}
                        height={360}
                        className="h-auto w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.3)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="relative mt-4 flex min-h-[8rem] flex-col justify-between rounded-[1.15rem] border border-white/12 bg-black/[0.08] p-4">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="select-none text-[2.6rem] font-black uppercase tracking-widest text-white/[0.06]">
                  Soutrali
                </span>
              </div>
              <div className="relative z-10" />
              {brands.length > 0 ? (
                <div className="relative z-10 mt-auto flex flex-wrap gap-1.5 pt-4">
                  {brands.map((b) => (
                    <span key={b} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {b}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {hasImages && brands.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {brands.map((b) => (
                <span key={b} className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {b}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-full bg-[#EDF6F0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#145440]">
        {eyebrow}
      </div>

      <h3 className="mt-4 text-xl font-semibold text-[#0E2E23] transition group-hover:text-[#145440]">{title}</h3>
      <p className="mt-3 max-w-[30ch] text-sm leading-6 text-slate-500">{description}</p>

      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{ctaSubLabel}</span>
        <span className="inline-flex items-center rounded-full bg-[#0F3D2E] px-3 py-1.5 text-xs font-semibold text-white transition group-hover:bg-[#145440]">
          {ctaLabel}
        </span>
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </>
  );

  if (!href) {
    return (
      <div className="group rounded-[1.75rem] bg-white p-6 shadow-[0_20px_60px_rgba(3,12,9,0.14)]">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group block rounded-[1.75rem] bg-white p-6 shadow-[0_20px_60px_rgba(3,12,9,0.14)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(3,12,9,0.22)]"
    >
      {content}
    </Link>
  );
}