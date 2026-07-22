import { cookies } from "next/headers";
import { AlbumForm } from "@/components/album-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";
import { planLimits } from "@/plans";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) return <main className="mx-auto mt-[8vh] max-w-3xl"><Card><CardHeader><CardTitle>ログインが必要です</CardTitle><CardDescription>Modからログインリンクを送信してください。</CardDescription></CardHeader></Card></main>;
  const [images, limits] = await Promise.all([managedImages(env, session.user_id), planLimits(env, session.user_id)]);
  const { error } = await searchParams;
  return <main className="mx-auto max-w-4xl space-y-4"><a className={buttonVariants({ variant: "ghost" })} href="/manage">← 管理画面</a><Card><CardHeader><CardTitle className="text-3xl">アルバムを作成</CardTitle><CardDescription>題名と画像を選び、共有用のアルバムを作ります。</CardDescription></CardHeader><CardContent><AlbumForm action="/manage/albums/create" images={images} error={error} submitLabel="アルバムを作成" allowProtected={limits.protectedSharing} maxImages={limits.imagesPerAlbum} /></CardContent></Card></main>;
}
