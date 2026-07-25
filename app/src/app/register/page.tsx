import type { Metadata } from "next";
import Script from "next/script";
import { getEnv } from "@/cloudflare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getI18n } from "@/i18n/server";
import { webRegistrationEnabled } from "@/web-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("webAuth.registerTitle") };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }, { t }] = await Promise.all([searchParams, getI18n()]);
  const env = getEnv();
  if (!webRegistrationEnabled(env) || status === "disabled") {
    return (
      <MessageCard
        title={t("webAuth.registrationDisabledTitle")}
        description={t("webAuth.registrationDisabled")}
      />
    );
  }
  if (status === "sent") {
    return (
      <MessageCard
        title={t("webAuth.checkEmailTitle")}
        description={t("webAuth.checkEmailRegister")}
      />
    );
  }
  const error =
    status === "invalid_email"
      ? t("webAuth.invalidEmail")
      : status === "invalid_code"
        ? t("webAuth.invalidCode")
        : status === "turnstile_failed"
          ? t("login.error.turnstile")
          : status
            ? t("login.error.invalidRequest")
            : null;
  return (
    <main className="mx-auto mt-[4vh] max-w-xl">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <Card className="bg-card/95 shadow-2xl">
        <CardHeader>
          <CardTitle>{t("webAuth.registerTitle")}</CardTitle>
          <CardDescription>{t("webAuth.registerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="mb-6 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t("webAuth.joinServer", { host: env.MINECRAFT_VERIFICATION_HOST })}</li>
            <li>{t("webAuth.copyKickCode")}</li>
            <li>{t("webAuth.enterRegistration")}</li>
          </ol>
          <form action="/auth/web-register" method="post" className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="register-code">{t("webAuth.code")}</Label>
              <Input
                id="register-code"
                name="code"
                autoComplete="one-time-code"
                placeholder="ABCD-EFGH"
                maxLength={12}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">{t("login.email")}</Label>
              <Input
                id="register-email"
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
              data-action="web_register"
              data-theme="dark"
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              {t("webAuth.sendRegistration")}
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("webAuth.haveAccount")}{" "}
              <a className="text-primary underline-offset-4 hover:underline" href="/login">
                {t("webAuth.loginLink")}
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function MessageCard({ title, description }: { title: string; description: string }) {
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
