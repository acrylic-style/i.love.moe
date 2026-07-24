import { headers } from "next/headers";
import { getEnv } from "@/cloudflare";
import { FavoriteButton } from "@/components/favorite-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { VerifiedMark } from "@/components/verified-mark";
import { getI18n } from "@/i18n/server";
import { displayServerAddress, listPublicServers, serverFavoriteIpHash } from "@/servers";

export default async function HomePage() {
  const { t } = await getI18n();
  const env = getEnv();
  const verifiedServers = await listPublicServers(env, "", {
    verifiedOnly: true,
    limit: 6,
    voterIpHash: await serverFavoriteIpHash(env, await headers()),
  });
  return (
    <main className="mx-auto mt-[8vh] max-w-5xl space-y-12">
      <Card className="mx-auto max-w-3xl bg-card/95 py-4 shadow-2xl backdrop-blur sm:py-8">
        <CardHeader className="gap-4 px-6 sm:px-10">
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe</p>
          <CardTitle className="text-4xl leading-tight tracking-tight sm:text-6xl">
            {t("home.title")}
          </CardTitle>
          <CardDescription className="text-base leading-7 sm:text-lg">
            {t("home.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 px-6 text-sm text-muted-foreground sm:px-10">
          <span>{t("home.beta")}</span>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="https://github.com/acrylic-style/i.love.moe/releases"
            target="_blank"
            rel="noreferrer"
          >
            {t("home.download")}
          </a>
          <a className={buttonVariants({ variant: "outline" })} href="/plus">
            {t("home.viewPlus")}
          </a>
        </CardContent>
      </Card>
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold">{t("home.verifiedServers")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.verifiedServersDescription")}</p>
          </div>
          <a className={buttonVariants({ variant: "outline" })} href="/servers?verified=1">
            {t("home.viewVerifiedServers")}
          </a>
        </div>
        {verifiedServers.length === 0 ? (
          <p className="text-muted-foreground">{t("home.noVerifiedServers")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {verifiedServers.map((server) => (
              <Card key={server.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <a className="min-w-0" href={`/servers/${server.slug ?? server.code}`}>
                      <CardTitle>
                        {server.display_name ??
                          displayServerAddress(server.display_address ?? null)}
                      </CardTitle>
                      <CardDescription className="mt-2 space-y-1">
                        <span className="block">
                          {displayServerAddress(server.display_address ?? null)}
                        </span>
                        <VerifiedMark label={t("servers.verified")} />
                      </CardDescription>
                    </a>
                    <FavoriteButton
                      endpoint={`/servers/favorites/server/${server.id}`}
                      initialCount={server.favorite_count}
                      initialFavorited={Boolean(server.viewer_favorited)}
                      label={t("servers.favorite")}
                      failedLabel={t("library.error.request_failed")}
                    />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
