import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { managedAlbumDetail } from "@/albums";
import { AlbumForm } from "@/components/album-form";
import { AlbumOrderEditor } from "@/components/album-order-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";
import { planLimits } from "@/plans";
import { getI18n } from "@/i18n/server";
import { managedServers } from "@/servers";

export const dynamic = "force-dynamic";

export default async function EditAlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { t } = await getI18n();
  const { id } = await params;
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const [detail, images, limits, servers] = await Promise.all([
    managedAlbumDetail(env, session.user_id, id),
    managedImages(env, session.user_id),
    planLimits(env, session.user_id),
    managedServers(env, session.user_id),
  ]);
  if (!detail) notFound();
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <a className={buttonVariants({ variant: "ghost" })} href="/manage">
        ← {t("common.backManage")}
      </a>
      <Card>
        <CardHeader className="gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-primary">Album</p>
            <CardTitle className="mt-1 text-3xl">{detail.album.title}</CardTitle>
            <a
              className="mt-2 inline-block text-sm text-primary hover:underline"
              href={`/${detail.album.code}`}
            >
              {t("album.openShared")}
            </a>
          </div>
          <form
            className="sm:col-start-2 sm:row-start-1"
            method="post"
            action={`/manage/albums/${id}/delete`}
          >
            <Button variant="destructive" type="submit">
              {t("album.delete")}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-10">
          <AlbumForm
            action={`/manage/albums/${id}/update`}
            images={images}
            album={detail.album}
            selectedImages={detail.images}
            error={error}
            submitLabel={t("album.save")}
            allowProtected={limits.protectedSharing}
            maxImages={limits.imagesPerAlbum}
            servers={servers}
          />
          <AlbumOrderEditor
            albumId={id}
            initialImages={detail.images.map(({ id: imageId, title, code }) => ({
              id: imageId,
              title,
              code,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
