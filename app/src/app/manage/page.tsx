import { cookies } from "next/headers";
import { managedAlbums } from "@/albums";
import { getEnv } from "@/cloudflare";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageTitleForm } from "@/components/image-title-form";
import { ServerMetadata } from "@/components/server-metadata";
import { authenticateSessionToken, managedImages } from "@/service";

export const dynamic = "force-dynamic";

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get("session")?.value;
  const env = getEnv();
  const session = await authenticateSessionToken(token, env);
  if (!session) {
    return <main className="mx-auto mt-[8vh] max-w-3xl"><Card><CardHeader><CardTitle>ログインが必要です</CardTitle><CardDescription>Modからログインリンクを送信してください。</CardDescription></CardHeader></Card></main>;
  }
  const [images, albums] = await Promise.all([managedImages(env, session.user_id), managedAlbums(env, session.user_id)]);
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-6xl space-y-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-bold tracking-[0.16em] text-primary">Dashboard</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">管理画面</h1></div>
        <form method="post" action="/logout"><Button type="submit" variant="outline">ログアウト</Button></form>
      </header>
      {error === "invalid_image_title" && <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">画像タイトルは100文字以内にしてください。</p>}

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold">アルバム</h2><p className="text-muted-foreground">画像をまとめて、ひとつのURLで共有できます。</p></div><a className={buttonVariants()} href="/manage/albums/new">アルバムを作成</a></div>
        {albums.length === 0 ? <p className="text-muted-foreground">アルバムはまだありません。</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{albums.map((album) => (
          <Card className="gap-4 overflow-hidden pt-0" key={album.id}>
            {album.cover_code ? <a href={`/manage/albums/${album.id}`} className="block overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}<img className="h-44 w-full object-cover transition-transform hover:scale-[1.02]" src={`/raw/${album.cover_code}`} alt="" />
            </a> : <div className="grid h-44 place-items-center bg-muted text-sm text-muted-foreground">画像なし</div>}
            <CardHeader><CardTitle>{album.title}</CardTitle><CardDescription>{album.image_count ?? 0}枚 · <a className="text-primary hover:underline" href={`/${album.code}`}>{album.code}</a></CardDescription></CardHeader>
            <CardFooter><a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/manage/albums/${album.id}`}>編集する</a></CardFooter>
          </Card>
        ))}</div>}
      </section>

      <section className="space-y-5">
        <div><h2 className="text-2xl font-semibold">画像</h2><p className="text-muted-foreground">タイトルは共有ページとアルバムに表示されます。</p></div>
        {images.length === 0 ? <p className="text-muted-foreground">管理できる画像はありません。</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => (
          <Card className="gap-4 overflow-hidden pt-0" key={image.id}>
            <a href={`/${image.code}`} className="block overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}<img className="h-44 w-full object-cover transition-transform hover:scale-[1.02]" src={`/raw/${image.code}`} alt={image.title ?? ""} />
            </a>
            <CardContent className="space-y-4">
              <ServerMetadata name={image.server_name} address={image.server_address} compact />
              <ImageTitleForm imageId={image.id} initialTitle={image.title} />
              <div className="flex items-center justify-between gap-3"><a className="text-sm text-primary hover:underline" href={`/${image.code}`}>{image.code}</a><form method="post" action={`/manage/images/${image.id}/delete`}><Button variant="destructive" size="sm" type="submit">削除</Button></form></div>
            </CardContent>
          </Card>
        ))}</div>}
      </section>
    </main>
  );
}
