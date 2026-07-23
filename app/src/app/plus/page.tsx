import { cookies } from "next/headers";
import { CheckIcon } from "lucide-react";
import { getEnv } from "@/cloudflare";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { subscriptionSummary } from "@/plans";
import { authenticateSessionToken } from "@/service";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { t } = await getI18n();
  const features = [
    t("plus.feature.uploads"),
    t("plus.feature.autoUpload"),
    t("plus.feature.retention"),
    t("plus.feature.albums"),
    t("plus.feature.visibility"),
    t("plus.feature.migration"),
  ];
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  const subscription = session ? await subscriptionSummary(env, session.user_id) : null;
  const { checkout } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <a className={buttonVariants({ variant: "ghost" })} href={session ? "/manage" : "/"}>
        ← {t("common.back")}
      </a>
      {checkout === "canceled" && (
        <p className="rounded-md border px-4 py-3 text-sm">{t("plus.canceled")}</p>
      )}
      <Card className="overflow-hidden border-primary/40 bg-card/95 shadow-2xl">
        <CardHeader className="text-center">
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe Plus</p>
          <CardTitle className="text-4xl sm:text-5xl">{t("plus.title")}</CardTitle>
          <CardDescription className="text-base">{t("plus.description")}</CardDescription>
        </CardHeader>
        <CardContent className="mx-auto w-full max-w-xl space-y-6">
          <div className="text-center">
            <span className="text-5xl font-bold">{t("plus.price")}</span>
            <span className="text-muted-foreground">{t("plus.perMonth")}</span>
            <p className="mt-2 text-sm text-muted-foreground">{t("plus.cancelAnytime")}</p>
          </div>
          <ul className="space-y-3">
            {features.map((feature) => (
              <li className="flex gap-3" key={feature}>
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            {t("plus.afterCancel")}
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          {!session ? (
            <a className={buttonVariants({ size: "lg" })} href="/manage">
              {t("plus.signIn")}
            </a>
          ) : subscription?.plan === "plus" ||
            (subscription?.status &&
              subscription.status !== "canceled" &&
              subscription.status !== "incomplete_expired") ? (
            <form method="post" action="/api/billing/portal">
              <Button size="lg" type="submit" variant="outline">
                {t("plus.manage")}
              </Button>
            </form>
          ) : (
            <form method="post" action="/api/billing/checkout">
              <Button size="lg" type="submit">
                {t("plus.start")}
              </Button>
            </form>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
