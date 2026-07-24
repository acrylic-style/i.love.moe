import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { authenticateSessionToken } from "@/service";
import { managedServers } from "@/servers";

export const dynamic = "force-dynamic";

export default async function ManageServersPage() {
  const { t } = await getI18n();
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const servers = await managedServers(env, session.user_id);
  return (
    <main className="mx-auto max-w-5xl space-y-8">
      <a className={buttonVariants({ variant: "ghost" })} href="/manage">
        ← {t("common.backManage")}
      </a>
      <header>
        <h1 className="text-4xl font-bold">{t("servers.manageTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("servers.manageDescription")}</p>
      </header>
      <a className={buttonVariants()} href="/manage/servers/claim">
        {t("servers.addOrClaim")}
      </a>
      {servers.length === 0 ? (
        <p>{t("servers.noManaged")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {servers.map((server) => (
            <a href={`/manage/servers/${server.id}`} key={server.id}>
              <Card className="h-full hover:border-primary">
                <CardHeader>
                  <CardTitle>{server.display_name ?? server.display_address}</CardTitle>
                  <CardDescription>
                    {server.verified_at ? t("servers.verified") : t("servers.unverified")}
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
