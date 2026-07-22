import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { findActiveAlbumByCode } from "@/albums";
import { getEnv } from "@/cloudflare";
import { LocalDateTime } from "@/components/local-date-time";
import { ServerMetadata } from "@/components/server-metadata";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <main className="mx-auto max-w-6xl"><Card className="bg-card/95 shadow-2xl"><CardHeader><p className="text-sm font-bold tracking-[0.16em] text-primary">Album</p><CardTitle className="text-3xl sm:text-5xl">{album.title}</CardTitle>
      {album.description && <CardDescription className="whitespace-pre-wrap text-base">{album.description}</CardDescription>}
      </CardHeader><CardContent>
      {images.length === 0 ? <p className="text-muted-foreground">このアルバムには、今見られる画像がありません。</p> : <div className="[columns:3_240px] [column-gap:1rem]">{images.map((albumImage) => (
        <figure className="mb-4 break-inside-avoid overflow-hidden rounded-xl border bg-card" key={albumImage.id}><a className="block overflow-hidden" href={`/${albumImage.code}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="h-auto w-full transition-transform hover:scale-[1.01]" src={`/raw/${albumImage.code}`} alt={albumImage.title ?? "Minecraft screenshot"} />
        </a>{(albumImage.title || albumImage.server_name || albumImage.server_address) && <figcaption className="space-y-2 px-4 py-3 text-sm">{albumImage.title && <p>{albumImage.title}</p>}<ServerMetadata name={albumImage.server_name} address={albumImage.server_address} compact /></figcaption>}</figure>
      ))}</div>}
      </CardContent></Card></main>;
  }
  const image = target.image;
  const expires = new Date(image.expires_at).toISOString();
  const size = image.byte_size >= 1024 * 1024
    ? `${(image.byte_size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(image.byte_size / 1024)} KB`;
  return (
    <main className="mx-auto max-w-6xl"><Card className="bg-card/95 shadow-2xl">
      {image.title && <CardHeader><CardTitle className="text-2xl sm:text-4xl">{image.title}</CardTitle></CardHeader>}
      <CardContent>
      {/* Uploaded PNG dimensions are validated server-side; Next image optimization is unnecessary here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="mx-auto max-h-[75vh] max-w-full rounded-lg bg-black/30 object-contain" src={`/raw/${code}`} width={image.width} height={image.height} alt={image.title ?? "Minecraft screenshot"} />
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{image.width} × {image.height}</span><span>{size}</span><span><LocalDateTime value={expires} />まで</span></div>
      <div className="mt-4"><ServerMetadata name={image.server_name} address={image.server_address} /></div>
      </CardContent></Card></main>
  );
}
