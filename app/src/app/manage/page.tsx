import { cookies } from "next/headers";
import { getEnv } from "@/cloudflare";
import { authenticateSessionToken, managedImages } from "@/service";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const token = (await cookies()).get("session")?.value;
  const env = getEnv();
  const session = await authenticateSessionToken(token, env);
  if (!session) {
    return <main className="card"><h1>ログインが必要です</h1><p>Modからログインリンクを送信してください。</p></main>;
  }
  const images = await managedImages(env, session.user_id);
  return (
    <main className="card">
      <header className="manage-header"><h1>画像管理</h1><form method="post" action="/logout"><button type="submit">ログアウト</button></form></header>
      {images.length === 0 ? <p className="empty">管理できる画像はございません。</p> : (
        <div className="grid">{images.map((image) => (
          <article className="item" key={image.id}>
            <a href={`/${image.code}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/raw/${image.code}`} alt="" />
            </a>
            <div className="item-actions"><a href={`/${image.code}`}>{image.code}</a><form method="post" action={`/manage/images/${image.id}/delete`}><button type="submit">削除</button></form></div>
          </article>
        ))}</div>
      )}
    </main>
  );
}
