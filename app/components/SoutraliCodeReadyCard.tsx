"use client";

import type { ReactNode } from "react";
import { CoteDIvoireServiceLogo } from "@/app/components/CoteDIvoireServiceLogo";

type SoutraliCodeReadyCardProps = {
  kind: "electricity" | "gift-card" | "airtime" | "data";
  locale: "fr" | "en";
  title: string;
  description: string;
  primaryLabel: string;
  primaryValue: string;
  productName: string;
  amountLabel: string;
  logoSrc?: string;
  logoAlt: string;
  recipientName: string;
  recipientContact?: string;
  detailLabel: string;
  detailValue: string;
  referenceLabel: string;
  referenceValue: string;
  note?: string;
  completedAt?: string;
  actions?: ReactNode;
  footerAction?: ReactNode;
};

const themeByKind = {
  electricity: {
    iconGradient: "from-[#FDE68A] via-[#FBBF24] to-[#F59E0B]",
    iconInk: "text-[#7C2D12]",
    panel: "border-amber-200 bg-[linear-gradient(180deg,#FFFDF7_0%,#FFF7E8_100%)] text-[#1C1917]",
    tokenPanel: "border-amber-100 bg-white/95",
    summaryPanel: "border-amber-100 bg-white",
    softPanel: "bg-amber-50 text-amber-900",
    checkBubble: "bg-emerald-500",
  },
  "gift-card": {
    iconGradient: "from-[#FDBA74] via-[#FB923C] to-[#EA580C]",
    iconInk: "text-[#7C2D12]",
    panel: "border-orange-200 bg-[linear-gradient(180deg,#FFF9F5_0%,#FFF1EA_100%)] text-[#1F2937]",
    tokenPanel: "border-orange-100 bg-white/95",
    summaryPanel: "border-orange-100 bg-white",
    softPanel: "bg-orange-50 text-orange-900",
    checkBubble: "bg-emerald-500",
  },
  airtime: {
    iconGradient: "from-[#BBF7D0] via-[#4ADE80] to-[#16A34A]",
    iconInk: "text-[#14532D]",
    panel: "border-emerald-200 bg-[linear-gradient(180deg,#F8FFFB_0%,#ECFDF5_100%)] text-[#1C1917]",
    tokenPanel: "border-emerald-100 bg-white/95",
    summaryPanel: "border-emerald-100 bg-white",
    softPanel: "bg-emerald-50 text-emerald-900",
    checkBubble: "bg-emerald-500",
  },
  data: {
    iconGradient: "from-[#BFDBFE] via-[#60A5FA] to-[#2563EB]",
    iconInk: "text-[#1E3A8A]",
    panel: "border-blue-200 bg-[linear-gradient(180deg,#F8FBFF_0%,#EFF6FF_100%)] text-[#1C1917]",
    tokenPanel: "border-blue-100 bg-white/95",
    summaryPanel: "border-blue-100 bg-white",
    softPanel: "bg-blue-50 text-blue-900",
    checkBubble: "bg-emerald-500",
  },
} as const;

function formatCompletedAt(completedAt: string | undefined, locale: "fr" | "en") {
  if (!completedAt) {
    return null;
  }

  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function CodeGlyph({ kind }: { kind: "electricity" | "gift-card" | "airtime" | "data" }) {
  if (kind === "gift-card") {
    return (
      <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none" aria-hidden="true">
        <rect x="10" y="20" width="44" height="24" rx="8" fill="currentColor" opacity="0.18" />
        <path d="M18 26h28v12H18z" fill="currentColor" opacity="0.9" />
        <path d="M32 26v12" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M25 20c0-3 2.4-5 5.2-5 3.1 0 4.8 2 4.8 5M39 20c0-3-1.7-5-4.8-5-2.8 0-5.2 2-5.2 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "airtime") {
    return (
      <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none" aria-hidden="true">
        <rect x="18" y="12" width="28" height="40" rx="8" fill="currentColor" opacity="0.15" />
        <rect x="22" y="16" width="20" height="28" rx="4" fill="currentColor" />
        <circle cx="32" cy="48" r="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "data") {
    return (
      <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none" aria-hidden="true">
        <path d="M14 44c4-8 10-12 18-12s14 4 18 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 36c3-5 7-8 12-8s9 3 12 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <path d="M27 29c1.5-2 3.2-3 5-3s3.5 1 5 3" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
        <circle cx="32" cy="48" r="3.5" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10" fill="none" aria-hidden="true">
      <path d="M35 8 18 35h11l-3 21 20-30H35l0-18Z" fill="currentColor" />
    </svg>
  );
}

export function SoutraliCodeReadyCard({
  kind,
  locale,
  title,
  description,
  primaryLabel,
  primaryValue,
  productName,
  amountLabel,
  logoSrc,
  logoAlt,
  recipientName,
  recipientContact,
  detailLabel,
  detailValue,
  referenceLabel,
  referenceValue,
  note,
  completedAt,
  actions,
  footerAction,
}: SoutraliCodeReadyCardProps) {
  const theme = themeByKind[kind];
  const completedLabel = formatCompletedAt(completedAt, locale);

  return (
    <section className={`rounded-[2rem] border p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)] ${theme.panel}`}>
      <div className="flex flex-col items-center text-center sm:px-2">
        <div className="relative">
          <div className={`flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${theme.iconGradient} ${theme.iconInk} shadow-[0_24px_60px_rgba(245,158,11,0.28)] sm:h-32 sm:w-32`}>
            <CodeGlyph kind={kind} />
          </div>
          <div className={`absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full ${theme.checkBubble} text-white shadow-lg sm:h-12 sm:w-12`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" aria-hidden="true">
              <path d="m6 12 4 4 8-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <h2 className="mt-5 text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] text-[#111827] sm:mt-6 sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:mt-3 sm:leading-7">{description}</p>
        {completedLabel ? <div className="mt-2 text-xs font-medium text-slate-400 sm:mt-3 sm:text-sm">{completedLabel}</div> : null}
      </div>

      <div className={`mt-6 rounded-[1.35rem] border p-4 sm:mt-8 sm:rounded-[1.6rem] sm:p-5 ${theme.tokenPanel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 sm:text-sm sm:normal-case sm:tracking-normal">{primaryLabel}</div>
            <div className="mt-2 break-words text-[1.3rem] font-semibold tracking-[0.12em] text-slate-900 sm:text-[1.85rem] sm:tracking-[0.16em]">{primaryValue}</div>
          </div>
          <div className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] sm:px-4 sm:py-2 sm:text-xs ${theme.softPanel}`}>
            {locale === "fr" ? "prêt" : "ready"}
          </div>
        </div>
      </div>

      <div className={`mt-5 rounded-[1.35rem] border p-4 sm:mt-6 sm:rounded-[1.6rem] sm:p-5 ${theme.summaryPanel}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 sm:gap-4 sm:pb-5">
          <div className="flex items-center gap-3">
            <CoteDIvoireServiceLogo src={logoSrc} alt={logoAlt} className="h-12 w-12 rounded-2xl border-slate-200 p-2 sm:h-14 sm:w-14" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:text-sm">AfriSendIQ Soutrali</div>
              <div className="mt-1 text-base font-semibold leading-6 text-slate-900 sm:text-xl">{productName}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:text-sm">{locale === "fr" ? "montant" : "amount"}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 sm:text-2xl">{amountLabel}</div>
          </div>
        </div>

        <div className="flex flex-col items-center py-5 text-center sm:py-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-200 bg-[radial-gradient(circle_at_top,#FEF3C7_0%,#FCD34D_100%)] text-2xl font-semibold text-slate-900 sm:h-24 sm:w-24 sm:text-3xl">
            {recipientName.trim().charAt(0).toUpperCase() || "A"}
          </div>
          <div className="mt-4 text-[1.7rem] font-semibold leading-tight tracking-[-0.04em] text-slate-900 sm:mt-5 sm:text-3xl">{recipientName}</div>
          {recipientContact ? <div className="mt-1.5 text-base font-medium text-slate-500 sm:mt-2 sm:text-xl">{recipientContact}</div> : null}
          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 sm:mt-5 sm:text-sm">{detailLabel}</div>
          <div className="mt-1.5 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">{detailValue}</div>
        </div>

        <div className="grid gap-3 border-t border-slate-200 pt-4 sm:gap-4 sm:pt-5 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{referenceLabel}</div>
            <div className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">{referenceValue}</div>
          </div>
          {note ? (
            <div className="rounded-2xl bg-slate-50 p-3.5 sm:p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{locale === "fr" ? "conseil" : "note"}</div>
              <div className="mt-2 text-sm leading-5 text-slate-600 sm:leading-6">{note}</div>
            </div>
          ) : null}
        </div>

        {actions ? <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:flex-row sm:flex-wrap">{actions}</div> : null}
      </div>

      {footerAction ? <div className="mt-6">{footerAction}</div> : null}
    </section>
  );
}