"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type CoteDIvoireLocale = "fr" | "en";

export type LocalizedText = {
  fr: string;
  en: string;
};

type CoteDIvoireLocaleContextValue = {
  locale: CoteDIvoireLocale;
  setLocale: (locale: CoteDIvoireLocale) => void;
};

const STORAGE_KEY = "afrisendiq-ci-locale";

const CoteDIvoireLocaleContext = createContext<CoteDIvoireLocaleContextValue | null>(null);

const localeListeners = new Set<() => void>();

function getStoredLocale(): CoteDIvoireLocale {
  if (typeof window === "undefined") {
    return "fr";
  }

  const storedLocale = window.localStorage.getItem(STORAGE_KEY);
  return storedLocale === "fr" || storedLocale === "en" ? storedLocale : "fr";
}

function subscribeToLocale(callback: () => void) {
  localeListeners.add(callback);

  if (typeof window !== "undefined") {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        callback();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      localeListeners.delete(callback);
      window.removeEventListener("storage", handleStorage);
    };
  }

  return () => {
    localeListeners.delete(callback);
  };
}

function setStoredLocale(nextLocale: CoteDIvoireLocale) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }

  localeListeners.forEach((listener) => listener());
}

export function CoteDIvoireLocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<CoteDIvoireLocale>(subscribeToLocale, getStoredLocale, () => "fr");

  const value = useMemo(
    () => ({
      locale,
      setLocale: (nextLocale: CoteDIvoireLocale) => {
        setStoredLocale(nextLocale);
      }
    }),
    [locale]
  );

  return <CoteDIvoireLocaleContext.Provider value={value}>{children}</CoteDIvoireLocaleContext.Provider>;
}

export function useCoteDIvoireLocale() {
  const context = useContext(CoteDIvoireLocaleContext);

  if (!context) {
    throw new Error("useCoteDIvoireLocale must be used inside CoteDIvoireLocaleProvider");
  }

  return context;
}

export function useLocalizedText(text: LocalizedText) {
  const { locale } = useCoteDIvoireLocale();
  return text[locale];
}

export function resolveLocalizedText(text: LocalizedText, locale: CoteDIvoireLocale) {
  return text[locale];
}