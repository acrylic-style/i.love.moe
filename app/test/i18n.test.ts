import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  localeFromAcceptLanguage,
  localeFromLanguageTag,
  resolveLocale,
} from "../src/i18n/config";
import { messages, translate } from "../src/i18n/messages";

describe("i18n", () => {
  it("normalizes supported browser language tags", () => {
    expect(localeFromLanguageTag("ja-JP")).toBe("ja");
    expect(localeFromLanguageTag("en-US")).toBe("en");
    expect(localeFromLanguageTag("fr-FR")).toBeUndefined();
  });

  it("honors Accept-Language quality values", () => {
    expect(localeFromAcceptLanguage("en-US;q=0.7, ja-JP;q=0.9")).toBe("ja");
    expect(localeFromAcceptLanguage("fr-FR, en;q=0.8")).toBe("en");
  });

  it("prefers a saved selection and otherwise uses the browser language", () => {
    expect(resolveLocale("en", "ja-JP")).toEqual({ locale: "en", preference: "en" });
    expect(resolveLocale(undefined, "ja-JP")).toEqual({ locale: "ja", preference: "auto" });
    expect(resolveLocale(undefined, "fr-FR")).toEqual({
      locale: DEFAULT_LOCALE,
      preference: "auto",
    });
  });

  it("keeps English and Japanese message keys aligned", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.ja).sort());
  });

  it("interpolates translated values", () => {
    expect(translate("en", "common.imageCount", { count: 3 })).toBe("3 images");
    expect(translate("ja", "common.imageCount", { count: 3 })).toBe("3枚");
  });
});
