"use client";

import Image from "next/image";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

const CURSEFORGE_URL = "https://www.curseforge.com/minecraft/mc-mods/i-moe";

interface SiteHeaderProps {
  publicBaseUrl: string;
  signedIn: boolean;
  registrationEnabled: boolean;
  customServer?: {
    name: string;
    href: string;
    iconUrl: string | null;
  };
}

export function SiteHeader({
  publicBaseUrl,
  customServer,
  signedIn,
  registrationEnabled,
}: SiteHeaderProps) {
  const { t } = useI18n();
  const homeUrl = new URL("/", publicBaseUrl).toString();
  const guideUrl = new URL("/guide", publicBaseUrl).toString();
  const plusUrl = new URL("/plus", publicBaseUrl).toString();
  const loginUrl = new URL(signedIn ? "/manage" : "/login", publicBaseUrl).toString();
  const registerUrl = new URL("/register", publicBaseUrl).toString();
  return (
    <header className="mx-auto w-full max-w-6xl border-b pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <a className="flex min-w-0 items-center gap-3" href={homeUrl}>
            <Image
              className="size-11 shrink-0 rounded-xl"
              src="/mod-icon.png"
              width={44}
              height={44}
              alt={t("header.logoAlt")}
              unoptimized
              priority
            />
            <span className="truncate text-lg font-semibold text-foreground">i.らぶ.moe</span>
          </a>
          {customServer ? (
            <a
              className="flex min-w-0 items-center gap-2 border-l pl-3 transition-opacity hover:opacity-80"
              href={customServer.href}
            >
              {customServer.iconUrl ? (
                <Image
                  className="size-9 shrink-0 rounded-lg object-cover"
                  src={customServer.iconUrl}
                  width={36}
                  height={36}
                  alt=""
                  unoptimized
                />
              ) : null}
              <span className="truncate font-medium text-foreground">{customServer.name}</span>
            </a>
          ) : null}
        </div>
        <nav
          className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-2"
          aria-label={t("header.navigation")}
        >
          <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={guideUrl}>
            {t("header.guide")}
          </a>
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href={plusUrl}>
            Plus
          </a>
          {!signedIn && registrationEnabled && (
            <a className={buttonVariants({ variant: "ghost", size: "sm" })} href={registerUrl}>
              {t("header.register")}
            </a>
          )}
          <a className={buttonVariants({ variant: "outline", size: "sm" })} href={loginUrl}>
            {signedIn ? t("manage.title") : t("header.login")}
          </a>
          <a
            className={buttonVariants({ size: "sm" })}
            href={CURSEFORGE_URL}
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
