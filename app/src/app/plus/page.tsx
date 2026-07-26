import { cookies } from "next/headers";
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
import { FREE_PLAN, PLUS_PLAN, subscriptionSummary } from "@/plans";
import { authenticateSessionToken } from "@/service";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { t } = await getI18n();
  const comparisonRows = [
    {
      key: "uploads",
      label: t("plus.compare.uploads"),
      free: t("plus.compare.images", { count: FREE_PLAN.uploadsPerThirtyDays }),
      plus: t("plus.compare.images", { count: PLUS_PLAN.uploadsPerThirtyDays }),
    },
    {
      key: "retention",
      label: t("plus.compare.retention"),
      free: t("plus.compare.days", { count: FREE_PLAN.retentionDays }),
      plus: t("plus.compare.days", { count: PLUS_PLAN.retentionDays }),
    },
    {
      key: "automaticUploads",
      label: t("plus.compare.automaticUploads"),
      free: t("plus.compare.notAvailable"),
      plus: t("plus.compare.available"),
    },
    {
      key: "albums",
      label: t("plus.compare.albums"),
      free: t("plus.compare.albumCount", { count: FREE_PLAN.albums }),
      plus: t("plus.compare.albumCount", { count: PLUS_PLAN.albums }),
    },
    {
      key: "imagesPerAlbum",
      label: t("plus.compare.imagesPerAlbum"),
      free: t("plus.compare.images", { count: FREE_PLAN.imagesPerAlbum }),
      plus: t("plus.compare.images", { count: PLUS_PLAN.imagesPerAlbum }),
    },
    {
      key: "sharing",
      label: t("plus.compare.sharing"),
      free: t("plus.compare.freeSharing"),
      plus: t("plus.compare.plusSharing"),
    },
    {
      key: "library",
      label: t("plus.compare.library"),
      free: t("plus.compare.freeLibrary"),
      plus: t("plus.compare.plusLibrary"),
    },
    {
      key: "serverPages",
      label: t("plus.compare.serverPages"),
      free: t("plus.compare.freeServerPages"),
      plus: t("plus.compare.plusServerPages"),
    },
    {
      key: "discordWebhooks",
      label: t("plus.compare.discordWebhooks"),
      free: t("plus.compare.webhookCount", { count: FREE_PLAN.serverDiscordWebhooks }),
      plus: t("plus.compare.webhookCount", { count: PLUS_PLAN.serverDiscordWebhooks }),
    },
    {
      key: "serverApi",
      label: t("plus.compare.serverApi"),
      free: t("plus.compare.notAvailable"),
      plus: t("plus.compare.readOnlyApi"),
    },
  ];
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  const subscription = session ? await subscriptionSummary(env, session.user_id) : null;
  const { checkout } = await searchParams;
  return (
    <main className="mx-auto max-w-5xl space-y-6">
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
        <CardContent className="mx-auto w-full space-y-8">
          <div className="text-center">
            <span className="text-5xl font-bold">{t("plus.price")}</span>
            <span className="text-muted-foreground">{t("plus.perMonth")}</span>
            <p className="mt-2 text-sm text-muted-foreground">{t("plus.cancelAnytime")}</p>
          </div>
          <section className="space-y-3" aria-labelledby="plan-comparison-title">
            <div className="text-center">
              <h2 id="plan-comparison-title" className="text-2xl font-semibold">
                {t("plus.compare.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("plus.compare.description")}</p>
            </div>
            <div className="overflow-hidden rounded-xl border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                  <caption className="sr-only">{t("plus.compare.caption")}</caption>
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="w-[36%] px-4 py-4 font-semibold" scope="col">
                        {t("plus.compare.feature")}
                      </th>
                      <th className="w-[32%] px-4 py-4 text-center" scope="col">
                        <span className="block font-semibold">{t("plus.compare.free")}</span>
                        <span className="mt-1 block text-xs font-normal text-muted-foreground">
                          {t("plus.compare.freePrice")}
                        </span>
                      </th>
                      <th
                        className="w-[32%] bg-primary/10 px-4 py-4 text-center text-primary"
                        scope="col"
                      >
                        <span className="block font-semibold">Plus</span>
                        <span className="mt-1 block text-xs font-normal">
                          {t("plus.price")}
                          {t("plus.perMonth")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonRows.map((row) => (
                      <tr className="border-t" key={row.key}>
                        <th className="px-4 py-4 font-medium" scope="row">
                          {row.label}
                        </th>
                        <td className="px-4 py-4 text-center text-muted-foreground">{row.free}</td>
                        <td className="bg-primary/5 px-4 py-4 text-center font-medium">
                          {row.plus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
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
