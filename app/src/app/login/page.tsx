import type { Metadata } from "next";
import Script from "next/script";
import { getEnv } from "@/cloudflare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("webAuth.loginTitle") };
}

export default async function WebLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, { t }] = await Promise.all([searchParams, getI18n()]);
  const env = getEnv();
  const error =
    status === "invalid_email"
      ? t("webAuth.invalidEmail")
      : status === "turnstile_failed"
        ? t("login.error.turnstile")
        : status === "invalid_request"
          ? t("login.error.invalidRequest")
          : null;
  if (status === "sent") {
    return (
      <AuthCard title={t("webAuth.checkEmailTitle")} description={t("webAuth.checkEmailLogin")} />
    );
  }
  return (
    <main className="mx-auto mt-[6vh] max-w-lg">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <Card className="bg-card/95 shadow-2xl">
        <CardHeader>
          <CardTitle>{t("webAuth.loginTitle")}</CardTitle>
          <CardDescription>{t("webAuth.loginDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/auth/web-login" method="post" className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="web-login-email">{t("login.email")}</Label>
              <Input
                id="web-login-email"
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
              data-action="web_login"
              data-theme="dark"
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              {t("webAuth.sendLogin")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("webAuth.needAccount")}{" "}
              <a className="text-primary underline-offset-4 hover:underline" href="/register">
                {t("webAuth.registerLink")}
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AuthCard({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto mt-[8vh] max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
