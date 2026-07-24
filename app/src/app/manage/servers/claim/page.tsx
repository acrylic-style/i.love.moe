import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getI18n } from "@/i18n/server";
import { authenticateSessionToken } from "@/service";
import { displayServerAddress } from "@/servers";

export const dynamic = "force-dynamic";

export default async function ServerClaimEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string; error?: string }>;
}) {
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const { t } = await getI18n();
  const { address = "", error } = await searchParams;
  const errorMessage =
    error === "invalid_address"
      ? t("servers.invalidAddress")
      : error === "already_claimed"
        ? t("servers.alreadyClaimed")
        : null;

  return (
    <main className="mx-auto mt-[6vh] max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t("servers.claimEntryTitle")}</CardTitle>
          <CardDescription>{t("servers.claimEntryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" method="post" action="/manage/servers/claim/start">
            <div className="space-y-2">
              <Label htmlFor="address">{t("servers.address")}</Label>
              <Input
                id="address"
                name="address"
                defaultValue={displayServerAddress(address)}
                placeholder={t("servers.addressPlaceholder")}
                required
              />
            </div>
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <Button type="submit">{t("servers.continueVerification")}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
