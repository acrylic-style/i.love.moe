"use client";

import { LOCALE_COOKIE, type LocalePreference } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

export function SiteFooter({ legalNoticeUrl }: { legalNoticeUrl?: string }) {
  const { preference, t } = useI18n();

  function changeLanguage(value: LocalePreference) {
    document.cookie =
      value === "auto"
        ? `${LOCALE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
        : `${LOCALE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <footer className="mx-auto mt-16 w-full max-w-6xl border-t py-6 text-sm text-muted-foreground">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 i.らぶ.moe</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2">
            <span>{t("footer.language")}</span>
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
              value={preference}
              aria-label={t("footer.language")}
              onChange={(event) => changeLanguage(event.target.value as LocalePreference)}
            >
              <option value="auto">{t("footer.language.auto")}</option>
              <option value="en">{t("footer.language.en")}</option>
              <option value="ja">{t("footer.language.ja")}</option>
            </select>
          </label>
          <nav aria-label={t("footer.legalNav")} className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="hover:text-foreground" href="/terms">
              {t("footer.terms")}
            </a>
            <a className="hover:text-foreground" href="/privacy">
              {t("footer.privacy")}
            </a>
            {legalNoticeUrl && (
              <a className="hover:text-foreground" href={legalNoticeUrl} rel="noreferrer">
                {t("footer.commercial")}
              </a>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}
