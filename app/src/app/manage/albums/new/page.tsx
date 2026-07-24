import { cookies } from "next/headers";
import { AlbumForm } from "@/components/album-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";
import { planLimits } from "@/plans";
import { getI18n } from "@/i18n/server";
import { managedServers } from "@/servers";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await getI18n();
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session)
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
  const [images, limits, servers] = await Promise.all([
    managedImages(env, session.user_id),
    planLimits(env, session.user_id),
    managedServers(env, session.user_id),
  ]);
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <a className={buttonVariants({ variant: "ghost" })} href="/manage">
        ← {t("common.backManage")}
      </a>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">{t("album.createTitle")}</CardTitle>
          <CardDescription>{t("album.createDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlbumForm
            action="/manage/albums/create"
            images={images}
            error={error}
            submitLabel={t("album.createSubmit")}
            allowProtected={limits.protectedSharing}
            maxImages={limits.imagesPerAlbum}
            servers={servers}
          />
        </CardContent>
      </Card>
    </main>
  );
}
