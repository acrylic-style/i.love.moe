import { cookies } from "next/headers";
import { managedAlbums } from "@/albums";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";

export const dynamic = "force-dynamic";

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const token = (await cookies()).get("session")?.value;
  const env = getEnv();
  const session = await authenticateSessionToken(token, env);
  if (!session) {
    return <main className="card"><h1>ログインが必要です</h1><p>Modからログインリンクを送信してください。</p></main>;
  }
  const [images, albums] = await Promise.all([
    managedImages(env, session.user_id),
    managedAlbums(env, session.user_id),
  ]);
  const { error } = await searchParams;
  return (
    <main className="card">
      <header className="manage-header"><div><p className="eyebrow">Dashboard</p><h1>管理画面</h1></div><form method="post" action="/logout"><button type="submit">ログアウト</button></form></header>
      {error === "invalid_image_title" && <p className="error">画像タイトルは100文字以内にしてください。</p>}
      <section className="manage-section">
        <div className="section-header"><div><h2>アルバム</h2><p className="muted">画像をまとめて、ひとつのURLで共有できます。</p></div><a className="button-link" href="/manage/albums/new">アルバムを作成</a></div>
        {albums.length === 0 ? <p className="empty">アルバムはまだありません。</p> : (
          <div className="grid">{albums.map((album) => (
            <article className="item" key={album.id}>
              {album.cover_code ? <a href={`/manage/albums/${album.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/raw/${album.cover_code}`} alt="" />
              </a> : <div className="empty-cover">画像なし</div>}
              <div className="item-body"><h3>{album.title}</h3><p className="muted">{album.image_count ?? 0}枚 · <a href={`/${album.code}`}>{album.code}</a></p><a href={`/manage/albums/${album.id}`}>編集する</a></div>
            </article>
          ))}</div>
        )}
      </section>
      <section className="manage-section">
      <div className="section-header"><div><h2>画像</h2><p className="muted">タイトルは共有ページとアルバムに表示されます。</p></div></div>
      {images.length === 0 ? <p className="empty">管理できる画像はありません。</p> : (
        <div className="grid">{images.map((image) => (
          <article className="item" key={image.id}>
            <a href={`/${image.code}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/raw/${image.code}`} alt={image.title ?? ""} />
            </a>
            <div className="item-body">
              <form className="stack" method="post" action={`/manage/images/${image.id}/title`}>
                <label htmlFor={`title-${image.id}`}>画像タイトル</label>
                <div className="inline-form"><input id={`title-${image.id}`} name="title" defaultValue={image.title ?? ""} maxLength={100} placeholder="タイトルなし" /><button type="submit">保存</button></div>
              </form>
              <div className="item-actions"><a href={`/${image.code}`}>{image.code}</a><form method="post" action={`/manage/images/${image.id}/delete`}><button className="danger" type="submit">削除</button></form></div>
            </div>
          </article>
        ))}</div>
      )}
      </section>
    </main>
  );
}
