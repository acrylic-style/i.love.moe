export const SUPPORTED_LOCALES = ["en", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocalePreference = Locale | "auto";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "i_love_moe_locale";

export function localeFromLanguageTag(value: string | null | undefined): Locale | undefined {
  if (!value) return undefined;
  const language = value.trim().toLowerCase().split(/[-_]/, 1)[0];
  return language === "en" || language === "ja" ? language : undefined;
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale | undefined {
  if (!value) return undefined;
  return value
    .split(",")
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(";");
      const qualityText = parameters
        .find((parameter) => parameter.trim().startsWith("q="))
        ?.trim()
        .slice(2);
      const quality = qualityText === undefined ? 1 : Number(qualityText);
      return {
        locale: localeFromLanguageTag(tag),
        quality: Number.isFinite(quality) ? quality : 0,
        index,
      };
    })
    .filter((candidate) => candidate.locale && candidate.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index)[0]?.locale;
}

export function resolveLocale(
  preference: string | null | undefined,
  acceptLanguage: string | null | undefined,
): {
  locale: Locale;
  preference: LocalePreference;
} {
  const saved = localeFromLanguageTag(preference);
  return saved
    ? { locale: saved, preference: saved }
    : { locale: localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE, preference: "auto" };
}
