"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale, LocalePreference } from "./config";
import { translate } from "./messages";

interface I18nContextValue {
  locale: Locale;
  preference: LocalePreference;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  preference,
  children,
}: I18nContextValue & { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, preference }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return {
    ...context,
    t: (key: string, values?: Record<string, string | number>) =>
      translate(context.locale, key, values),
  };
}
