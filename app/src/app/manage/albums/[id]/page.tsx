import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { managedAlbumDetail } from "@/albums";
import { AlbumForm } from "@/components/album-form";
import { AlbumOrderEditor } from "@/components/album-order-editor";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";

export const dynamic = "force-dynamic";

export default async function EditAlbumPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const [detail, images] = await Promise.all([
    managedAlbumDetail(env, session.user_id, id),
    managedImages(env, session.user_id),
  ]);
  if (!detail) notFound();
  const { error } = await searchParams;
  return <main className="card"><a href="/manage">← 管理画面</a>
    <div className="section-header"><div><p className="eyebrow">Album</p><h1>{detail.album.title}</h1><a href={`/${detail.album.code}`}>共有ページを開く</a></div>
      <form method="post" action={`/manage/albums/${id}/delete`}><button className="danger" type="submit">アルバムを削除</button></form>
    </div>
    <AlbumForm action={`/manage/albums/${id}/update`} images={images} album={detail.album} selectedImages={detail.images} error={error} submitLabel="内容を保存" />
    <AlbumOrderEditor albumId={id} initialImages={detail.images.map(({ id: imageId, title, code }) => ({ id: imageId, title, code }))} />
  </main>;
}
