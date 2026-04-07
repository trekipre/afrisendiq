"use client";

import { useCoteDIvoireLocale } from "@/app/components/CoteDIvoireLocale";

export function CoteDIvoireLanguageSwitch() {
  const { locale, setLocale } = useCoteDIvoireLocale();

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 text-sm text-white backdrop-blur">
      <button
        type="button"
        onClick={() => setLocale("fr")}
        className={`rounded-full px-3 py-1.5 font-semibold transition ${locale === "fr" ? "bg-white text-[#0E2E23]" : "text-emerald-50 hover:bg-white/10"}`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-1.5 font-semibold transition ${locale === "en" ? "bg-white text-[#0E2E23]" : "text-emerald-50 hover:bg-white/10"}`}
      >
        EN
      </button>
    </div>
  );
}