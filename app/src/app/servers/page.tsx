import { getEnv } from "@/cloudflare";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getI18n } from "@/i18n/server";
import { displayServerAddress, listPublicServers } from "@/servers";

export const dynamic = "force-dynamic";

export default async function ServersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { t } = await getI18n();
  const query = (await searchParams).q ?? "";
  const servers = await listPublicServers(getEnv(), query);
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-4xl font-bold">{t("servers.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("servers.description")}</p>
      </header>
      <form>
        <Input name="q" defaultValue={query} placeholder={t("servers.search")} />
      </form>
      {servers.length === 0 ? (
        <p className="text-muted-foreground">{t("servers.empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <a href={`/servers/${server.slug ?? server.code}`} key={server.id}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle>
                    {server.display_name ?? displayServerAddress(server.display_address ?? null)}
                  </CardTitle>
                  <CardDescription>
                    {displayServerAddress(server.display_address ?? null)}
                    {server.verified_at ? ` · ${t("servers.verified")}` : ""}
                  </CardDescription>
                </CardHeader>
              </Card>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
