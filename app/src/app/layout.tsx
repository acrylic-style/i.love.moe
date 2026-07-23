import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: "i.らぶ.moe", template: "%s | i.らぶ.moe" },
    description: t("metadata.description"),
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const legalNoticeUrl = validLegalNoticeUrl(process.env.LEGAL_NOTICE_URL);
  const { locale, preference } = await getI18n();
  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen px-3 py-6 antialiased sm:px-6 sm:py-10">
        <I18nProvider locale={locale} preference={preference}>
          <div className="flex min-h-[calc(100vh-3rem)] flex-col sm:min-h-[calc(100vh-5rem)]">
            <div className="flex-1">{children}</div>
            <SiteFooter legalNoticeUrl={legalNoticeUrl} />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

function validLegalNoticeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
