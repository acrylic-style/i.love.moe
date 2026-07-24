import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { ServerClaim } from "@/components/server-claim";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { authenticateSessionToken } from "@/service";
import { unclaimedServerById } from "@/servers";

export default async function ClaimServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale } = await getI18n();
  const { id } = await params;
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const server = await unclaimedServerById(env, id);
  if (!server) notFound();
  const japanese = locale === "ja";
  return (
    <main className="mx-auto mt-[6vh] max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{japanese ? "サーバーの所有確認" : "Verify server ownership"}</CardTitle>
          <CardDescription>{server.display_address}</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerClaim serverId={id} addressId={server.address_id} japanese={japanese} />
        </CardContent>
      </Card>
    </main>
  );
}
