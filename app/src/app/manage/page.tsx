import { cookies } from "next/headers";
import { managedAlbums } from "@/albums";
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
import { ServerMetadata } from "@/components/server-metadata";
import { authenticateSessionToken, managedImages } from "@/service";
import { planLimits, subscriptionPriceLabel, subscriptionSummary, uploadUsage } from "@/plans";
import { LocalDateTime } from "@/components/local-date-time";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const { locale, t } = await getI18n();
  const token = (await cookies()).get("session")?.value;
  const env = getEnv();
  const session = await authenticateSessionToken(token, env);
  if (!session) {
    return (
      <main className="mx-auto mt-[8vh] max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.required")}</CardTitle>
            <CardDescription>{t("auth.fromMod")}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }
  const [images, albums, subscription, limits, usage, migration] = await Promise.all([
    managedImages(env, session.user_id, 6),
    managedAlbums(env, session.user_id),
    subscriptionSummary(env, session.user_id),
    planLimits(env, session.user_id),
    uploadUsage(env, session.user_id),
    env.DB.prepare(
      `SELECT
        SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'failed' AND attempts >= 5 THEN 1 ELSE 0 END) AS failed
      FROM retention_jobs WHERE user_id = ?`,
    )
      .bind(session.user_id)
      .first<{ pending: number | null; failed: number | null }>(),
  ]);
  const { error, checkout } = await searchParams;
  const priceLabel = subscriptionPriceLabel(subscription, locale);
  const visibilityLabel = (visibility: "unlisted" | "private" | "passphrase") =>
    t(`visibility.${visibility}`);
  return (
    <main className="mx-auto max-w-6xl space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-[0.16em] text-primary">{t("manage.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("manage.title")}</h1>
        </div>
        <form method="post" action="/logout">
          <Button type="submit" variant="outline">
            {t("manage.logout")}
          </Button>
        </form>
      </header>
      {error === "invalid_image_title" && (
        <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t("manage.invalidTitle")}
        </p>
      )}
      {checkout === "success" && subscription.plan !== "plus" && (
        <p className="rounded-md border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          {t("manage.checkoutPending")}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-bold tracking-[0.16em] text-primary">{t("manage.plan")}</p>
              <CardTitle className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <span>{subscription.plan === "plus" ? "Plus" : t("manage.freePlan")}</span>
                {priceLabel && (
                  <span className="text-base font-normal text-muted-foreground">{priceLabel}</span>
                )}
              </CardTitle>
              <CardDescription>
                {t("manage.uploadUsage", { usage, limit: limits.uploadsPerThirtyDays })}
              </CardDescription>
            </div>
            {subscription.plan === "plus" ||
            (subscription.status &&
              subscription.status !== "canceled" &&
              subscription.status !== "incomplete_expired") ? (
              <form method="post" action="/api/billing/portal">
                <Button type="submit" variant="outline">
                  {t("manage.manageSubscription")}
                </Button>
              </form>
            ) : (
              <a className={buttonVariants()} href="/plus">
                {t("home.viewPlus")}
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("manage.retention", { days: limits.retentionDays, albums: limits.albums })}</p>
          {subscription.scheduledCancellationAt && (
            <p>
              {t("manage.cancelScheduledBefore")}{" "}
              <LocalDateTime value={new Date(subscription.scheduledCancellationAt).toISOString()} />
              {t("manage.cancelScheduledAfter")}
            </p>
          )}
          {(migration?.pending ?? 0) > 0 && (
            <p>{t("manage.migrating", { count: migration?.pending ?? 0 })}</p>
          )}
          {(migration?.failed ?? 0) > 0 && (
            <p className="text-destructive">
              {t("manage.migrationFailed", { count: migration?.failed ?? 0 })}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t("manage.albums")}</h2>
            <p className="text-muted-foreground">{t("manage.albumsDescription")}</p>
          </div>
          {albums.length < limits.albums ? (
            <a className={buttonVariants()} href="/manage/albums/new">
              {t("manage.createAlbum")}
            </a>
          ) : (
            <a className={buttonVariants({ variant: "outline" })} href="/plus">
              {t("manage.increaseLimit")}
            </a>
          )}
        </div>
        {albums.length === 0 ? (
          <p className="text-muted-foreground">{t("manage.noAlbums")}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <Card className="gap-4 overflow-hidden pt-0" key={album.id}>
                {album.cover_code ? (
                  <a href={`/manage/albums/${album.id}`} className="block overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="h-44 w-full object-cover transition-transform hover:scale-[1.02]"
                      src={`/raw/${album.cover_code}`}
                      alt=""
                    />
                  </a>
                ) : (
                  <div className="grid h-44 place-items-center bg-muted text-sm text-muted-foreground">
                    {t("manage.noImagesInAlbum")}
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{album.title}</CardTitle>
                  <CardDescription>
                    {t("common.imageCount", { count: album.image_count ?? 0 })} ·{" "}
                    {visibilityLabel(album.visibility)} ·{" "}
                    <a className="text-primary hover:underline" href={`/${album.code}`}>
                      {album.code}
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <a
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                    href={`/manage/albums/${album.id}`}
                  >
                    {t("common.edit")}
                  </a>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t("manage.recentImages")}</h2>
            <p className="text-muted-foreground">{t("manage.recentImagesDescription")}</p>
          </div>
          <a className={buttonVariants({ variant: "outline" })} href="/manage/images">
            {t("manage.openLibrary")}
          </a>
        </div>
        {images.length === 0 ? (
          <p className="text-muted-foreground">{t("manage.noImages")}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <Card className="gap-4 overflow-hidden pt-0" key={image.id}>
                <a href={`/manage/images/${image.id}`} className="block overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="h-44 w-full object-cover transition-transform hover:scale-[1.02]"
                    src={`/raw/${image.code}`}
                    alt={image.title ?? ""}
                  />
                </a>
                <CardContent className="space-y-3">
                  <div>
                    <h3 className="truncate font-semibold">
                      {image.title ?? t("common.untitled")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {visibilityLabel(image.visibility)}
                    </p>
                  </div>
                  <ServerMetadata name={image.server_name} address={image.server_address} compact />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <a className="text-sm text-primary hover:underline" href={`/${image.code}`}>
                      {image.code}
                    </a>
                    <a
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      href={`/manage/images/${image.id}`}
                    >
                      {t("common.edit")}
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
