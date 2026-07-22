import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "i.らぶ.moe", template: "%s | i.らぶ.moe" },
  description: "Minecraftのスクリーンショットを、短いURLですぐ共有。",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const legalNoticeUrl = validLegalNoticeUrl(process.env.LEGAL_NOTICE_URL);
  return <html lang="ja" className="dark"><body className="min-h-screen px-3 py-6 antialiased sm:px-6 sm:py-10"><div className="flex min-h-[calc(100vh-3rem)] flex-col sm:min-h-[calc(100vh-5rem)]"><div className="flex-1">{children}</div><SiteFooter legalNoticeUrl={legalNoticeUrl} /></div></body></html>;
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
