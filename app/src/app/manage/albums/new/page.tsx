import { cookies } from "next/headers";
import { AlbumForm } from "@/components/album-form";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) return <main className="card"><h1>ログインが必要です</h1><p>Modからログインリンクを送信してください。</p></main>;
  const images = await managedImages(env, session.user_id);
  const { error } = await searchParams;
  return <main className="card"><a href="/manage">← 管理画面</a><h1>アルバムを作成</h1>
    <AlbumForm action="/manage/albums/create" images={images} error={error} submitLabel="アルバムを作成" />
  </main>;
}
