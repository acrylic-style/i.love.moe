"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

//const MODRINTH_URL = "https://modrinth.com/mod/i-love-moe";

// Modrinth is still under review
const MODRINTH_URL = "https://github.com/acrylic-style/i.love.moe/releases";

export function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="mx-auto w-full max-w-6xl border-b pb-4">
      <div className="flex items-center justify-between gap-3">
        <a className="flex min-w-0 items-center gap-3" href="/">
          <Image
            className="size-11 rounded-xl"
            src="/mod-icon.png"
            width={44}
            height={44}
            alt={t("header.logoAlt")}
            unoptimized
            priority
          />
          <span className="hidden truncate text-lg font-semibold text-foreground sm:block">
            i.らぶ.moe
          </span>
        </a>
        <nav
          className="flex shrink-0 items-center gap-1 sm:gap-2"
          aria-label={t("header.navigation")}
        >
          <a className={buttonVariants({ variant: "ghost", size: "sm" })} href="/guide">
            {t("header.guide")}
          </a>
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href="/plus">
            Plus
          </a>
          <a
            className={buttonVariants({ size: "sm" })}
            href={MODRINTH_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("header.download")}</span>
            <span className="sm:hidden">{t("header.downloadShort")}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
