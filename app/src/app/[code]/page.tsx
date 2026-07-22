import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { findActiveAlbumByCode } from "@/albums";
import { getEnv } from "@/cloudflare";
import { LocalDateTime } from "@/components/local-date-time";
import { findActiveImageByCode, SHORT_CODE_PATTERN } from "@/service";

export const dynamic = "force-dynamic";

const resolveTarget = cache(async (code: string) => {
  const env = getEnv();
  const image = await findActiveImageByCode(env, code);
  if (image) return { type: "image" as const, image };
  const album = await findActiveAlbumByCode(env, code);
  return album ? { type: "album" as const, detail: album } : null;
});

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) return {};
  const target = await resolveTarget(code);
  if (!target) return {};
  return {
    title: target.type === "image" ? (target.image.title ?? `画像 ${code}`) : target.detail.album.title,
    description: target.type === "album" ? (target.detail.album.description ?? undefined) : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ViewerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const target = await resolveTarget(code);
  if (!target) notFound();
  if (target.type === "album") {
    const { album, images } = target.detail;
    return <main className="card album-viewer"><p className="eyebrow">Album</p><h1>{album.title}</h1>
      {album.description && <p className="album-description">{album.description}</p>}
      {images.length === 0 ? <p className="empty">このアルバムには現在閲覧できる画像がございません。</p> : <div className="album-grid">{images.map((albumImage) => (
        <figure key={albumImage.id}><a href={`/${albumImage.code}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/raw/${albumImage.code}`} alt={albumImage.title ?? "Minecraft screenshot"} />
        </a>{albumImage.title && <figcaption>{albumImage.title}</figcaption>}</figure>
      ))}</div>}
    </main>;
  }
  const image = target.image;
  const expires = new Date(image.expires_at).toISOString();
  const size = image.byte_size >= 1024 * 1024
    ? `${(image.byte_size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(image.byte_size / 1024)} KB`;
  return (
    <main className="card viewer">
      {image.title && <h1 className="image-title">{image.title}</h1>}
      {/* Uploaded PNG dimensions are validated server-side; Next image optimization is unnecessary here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/raw/${code}`} width={image.width} height={image.height} alt={image.title ?? "Minecraft screenshot"} />
      <div className="meta"><span>{image.width} × {image.height}</span><span>{size}</span><span><LocalDateTime value={expires} />まで</span></div>
    </main>
  );
}
