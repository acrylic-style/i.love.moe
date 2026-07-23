import type { Metadata } from "next";
import Script from "next/script";
import { getEnv } from "@/cloudflare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getI18n } from "@/i18n/server";
import { browserLoginChallengeAvailable } from "@/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function MinecraftLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ token }, { status }, { t }] = await Promise.all([params, searchParams, getI18n()]);

  if (status === "sent") {
    return <LoginCard title={t("login.sentTitle")} description={t("login.sentDescription")} />;
  }

  const env = getEnv();
  const available = await browserLoginChallengeAvailable(token, env);
  if (!available) {
    return (
      <LoginCard title={t("login.invalidTitle")} description={t("login.invalidDescription")} />
    );
  }

  const error =
    status === "invalid_email"
      ? t("login.error.invalidEmail")
      : status === "turnstile_failed"
        ? t("login.error.turnstile")
        : status === "unavailable"
          ? t("login.error.unavailable")
          : status
            ? t("login.error.invalidRequest")
            : null;

  return (
    <main className="mx-auto mt-[8vh] max-w-lg">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <Card className="bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader>
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe</p>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/browser-login" method="post" className="space-y-5">
            <input type="hidden" name="token" value={token} />
            <div className="space-y-2">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </div>
            <div
              className="cf-turnstile"
              data-sitekey={env.TURNSTILE_SITE_KEY}
              data-action="minecraft_login"
              data-theme="dark"
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              {t("login.submit")}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">{t("login.privacyNote")}</p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function LoginCard({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto mt-[8vh] max-w-lg">
      <Card className="bg-card/95 shadow-2xl backdrop-blur">
        <CardHeader>
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe</p>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
