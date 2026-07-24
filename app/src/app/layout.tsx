import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getEnv } from "@/cloudflare";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { resolveCustomDomain } from "@/custom-domains";
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
  const env = getEnv();
  const legalNoticeUrl = validLegalNoticeUrl(process.env.LEGAL_NOTICE_URL);
  const { locale, preference } = await getI18n();
  const requestHostname = hostnameFromHostHeader((await headers()).get("host"));
  const officialHostnames = new Set([
    new URL(env.PUBLIC_BASE_URL).hostname.toLowerCase(),
    new URL(env.MINECRAFT_PUBLIC_BASE_URL).hostname.toLowerCase(),
  ]);
  const customDomain =
    requestHostname && !officialHostnames.has(requestHostname)
      ? await resolveCustomDomain(env, requestHostname)
      : null;
  const customServer =
    customDomain?.status === "active"
      ? {
          name:
            customDomain.server_display_name ??
            customDomain.server_display_address ??
            requestHostname!,
          href: `https://${requestHostname}/`,
          iconUrl: customDomain.server_icon_key
            ? `/servers/assets/${customDomain.server_id}/icon`
            : null,
        }
      : undefined;
  return (
    <html lang={locale} className="dark">
      <body className="min-h-screen px-3 py-6 antialiased sm:px-6 sm:py-10">
        <I18nProvider locale={locale} preference={preference}>
          <div className="flex min-h-[calc(100vh-3rem)] flex-col sm:min-h-[calc(100vh-5rem)]">
            <SiteHeader publicBaseUrl={env.PUBLIC_BASE_URL} customServer={customServer} />
            <div className="flex-1 pt-6 sm:pt-10">{children}</div>
            <SiteFooter legalNoticeUrl={legalNoticeUrl} />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

function hostnameFromHostHeader(host: string | null): string | null {
  if (!host) return null;
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return null;
  }
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
