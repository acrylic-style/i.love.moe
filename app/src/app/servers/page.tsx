import { headers } from "next/headers";
import { getEnv } from "@/cloudflare";
import { FavoriteButton } from "@/components/favorite-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VerifiedMark } from "@/components/verified-mark";
import { getI18n } from "@/i18n/server";
import { displayServerAddress, listPublicServers, serverFavoriteIpHash } from "@/servers";

export const dynamic = "force-dynamic";

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; verified?: string }>;
}) {
  const { t } = await getI18n();
  const params = await searchParams;
  const query = params.q ?? "";
  const verifiedOnly = params.verified === "1";
  const env = getEnv();
  const servers = await listPublicServers(env, query, {
    verifiedOnly,
    voterIpHash: await serverFavoriteIpHash(env, await headers()),
  });
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-4xl font-bold">{t("servers.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("servers.description")}</p>
      </header>
      <div className="flex flex-wrap gap-2">
        <a
          className={buttonVariants({ variant: verifiedOnly ? "outline" : "default" })}
          href="/servers"
        >
          {t("servers.all")}
        </a>
        <a
          className={buttonVariants({ variant: verifiedOnly ? "default" : "outline" })}
          href="/servers?verified=1"
        >
          {t("servers.verifiedOnly")}
        </a>
      </div>
      <form>
        {verifiedOnly && <input type="hidden" name="verified" value="1" />}
        <Input name="q" defaultValue={query} placeholder={t("servers.search")} />
      </form>
      {servers.length === 0 ? (
        <p className="text-muted-foreground">{t("servers.empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const href = `/servers/${server.slug ?? server.code}`;
            return (
              <Card className="h-full transition-colors hover:border-primary" key={server.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <a className="min-w-0" href={href}>
                      <CardTitle>
                        {server.display_name ??
                          displayServerAddress(server.display_address ?? null)}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {displayServerAddress(server.display_address ?? null)}
                        {server.verified_at && (
                          <>
                            {" · "}
                            <VerifiedMark label={t("servers.verified")} />
                          </>
                        )}
                      </CardDescription>
                    </a>
                    {server.verified_at && (
                      <FavoriteButton
                        endpoint={`/servers/favorites/server/${server.id}`}
                        initialCount={server.favorite_count}
                        initialFavorited={Boolean(server.viewer_favorited)}
                        label={t("servers.favorite")}
                        failedLabel={t("library.error.request_failed")}
                      />
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
