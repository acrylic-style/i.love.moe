import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { findActiveAlbumByCode } from "@/albums";
import { getEnv } from "@/cloudflare";
import { LocalDateTime } from "@/components/local-date-time";
import { ServerMetadata } from "@/components/server-metadata";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findActiveImageByCode, SHORT_CODE_PATTERN } from "@/service";
import { authorizeTarget } from "@/access";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PassphraseInput } from "@/components/passphrase-input";
import { getI18n } from "@/i18n/server";
import { buildOpenGraphImage } from "@/og";

export const dynamic = "force-dynamic";

const resolveTarget = cache(
  async (code: string, cookieHeader: string | null, albumCode?: string) => {
    const env = getEnv();
    const image = await findActiveImageByCode(env, code);
    if (image) {
      const direct = await authorizeTarget(cookieHeader, env, "image", image);
      const albumDetail =
        albumCode && SHORT_CODE_PATTERN.test(albumCode)
          ? await findActiveAlbumByCode(env, albumCode)
          : null;
      const imageBelongsToAlbum =
        albumDetail?.images.some((albumImage) => albumImage.id === image.id) ?? false;
      const viaAlbum =
        !direct && albumDetail && imageBelongsToAlbum
          ? await authorizeTarget(cookieHeader, env, "album", albumDetail.album)
          : false;
      return {
        type: "image" as const,
        image,
        allowed: direct || viaAlbum,
        albumCode,
        publicAlbum:
          imageBelongsToAlbum && albumDetail?.album.visibility === "unlisted"
            ? albumDetail.album
            : null,
      };
    }
    const album = await findActiveAlbumByCode(env, code);
    return album
      ? {
          type: "album" as const,
          detail: album,
          allowed: await authorizeTarget(cookieHeader, env, "album", album.album),
        }
      : null;
  },
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ album?: string }>;
}): Promise<Metadata> {
  const { t } = await getI18n();
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) return {};
  const cookieHeader = (await headers()).get("cookie");
  const { album } = await searchParams;
  const target = await resolveTarget(code, cookieHeader, album);
  if (!target || !target.allowed)
    return { title: t("viewer.sharePage"), robots: { index: false, follow: false } };
  const env = getEnv();
  const title =
    target.type === "image"
      ? (target.image.title ?? t("viewer.imageTitle", { code }))
      : target.detail.album.title;
  const description =
    target.type === "album"
      ? (target.detail.album.description ?? t("viewer.albumPreviewDescription"))
      : t("viewer.imagePreviewDescription");
  const shareVisibility =
    target.type === "image"
      ? target.image.visibility === "unlisted"
        ? target.image.visibility
        : target.publicAlbum?.visibility
      : target.detail.album.visibility;
  const previewImage =
    shareVisibility === "unlisted"
      ? target.type === "image"
        ? buildOpenGraphImage(
            env.PUBLIC_BASE_URL,
            shareVisibility,
            target.image,
            target.publicAlbum?.code,
          )
        : buildOpenGraphImage(env.PUBLIC_BASE_URL, shareVisibility, target.detail.images[0], code)
      : undefined;
  const pageUrl = new URL(`/${code}`, `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/`);
  if (target.type === "image" && target.publicAlbum) {
    pageUrl.searchParams.set("album", target.publicAlbum.code);
  }
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "i.らぶ.moe",
      url: pageUrl.toString(),
      title,
      description,
      images: previewImage ? [previewImage] : undefined,
    },
    twitter: {
      card: previewImage ? "summary_large_image" : "summary",
      title,
      description,
      images: previewImage ? [previewImage.url] : undefined,
    },
    robots: { index: false, follow: false },
  };
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ album?: string; error?: string }>;
}) {
  const { t } = await getI18n();
  const { code } = await params;
  const query = await searchParams;
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const target = await resolveTarget(code, (await headers()).get("cookie"), query.album);
  if (!target) notFound();
  if (!target.allowed) {
    const visibility =
      target.type === "image" ? target.image.visibility : target.detail.album.visibility;
    if (visibility !== "passphrase") notFound();
    return <PassphraseChallenge code={code} error={query.error} />;
  }
  if (target.type === "album") {
    const { album, images } = target.detail;
    return (
      <main className="mx-auto max-w-6xl">
        <Card className="bg-card/95 shadow-2xl">
          <CardHeader>
            <p className="text-sm font-bold tracking-[0.16em] text-primary">Album</p>
            <CardTitle className="text-3xl sm:text-5xl">{album.title}</CardTitle>
            {album.description && (
              <CardDescription className="whitespace-pre-wrap text-base">
                {album.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <p className="text-muted-foreground">{t("viewer.albumEmpty")}</p>
            ) : (
              <div className="[columns:3_240px] [column-gap:1rem]">
                {images.map((albumImage) => (
                  <figure
                    className="mb-4 break-inside-avoid overflow-hidden rounded-xl border bg-card"
                    key={albumImage.id}
                  >
                    <a className="block overflow-hidden" href={`/${albumImage.code}?album=${code}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="h-auto w-full transition-transform hover:scale-[1.01]"
                        src={`/raw/${albumImage.code}?album=${code}`}
                        alt={albumImage.title ?? "Minecraft screenshot"}
                      />
                    </a>
                    {(albumImage.title || albumImage.server_name || albumImage.server_address) && (
                      <figcaption className="space-y-2 px-4 py-3 text-sm">
                        {albumImage.title && <p>{albumImage.title}</p>}
                        <ServerMetadata
                          name={albumImage.server_name}
                          address={albumImage.server_address}
                          compact
                        />
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }
  const image = target.image;
  const expires = new Date(image.expires_at).toISOString();
  const size =
    image.byte_size >= 1024 * 1024
      ? `${(image.byte_size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.ceil(image.byte_size / 1024)} KB`;
  const rawAlbumQuery = target.albumCode ? `?album=${encodeURIComponent(target.albumCode)}` : "";
  return (
    <main className="mx-auto max-w-6xl">
      <Card className="bg-card/95 shadow-2xl">
        {image.title && (
          <CardHeader>
            <CardTitle className="text-2xl sm:text-4xl">{image.title}</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          {/* Uploaded PNG dimensions are validated server-side; Next image optimization is unnecessary here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mx-auto max-h-[75vh] max-w-full rounded-lg bg-black/30 object-contain"
            src={`/raw/${code}${rawAlbumQuery}`}
            width={image.width}
            height={image.height}
            alt={image.title ?? "Minecraft screenshot"}
          />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              {image.width} × {image.height}
            </span>
            <span>{size}</span>
            <span>
              <LocalDateTime value={expires} />
              {` ${t("common.until")}`}
            </span>
          </div>
          <div className="mt-4">
            <ServerMetadata name={image.server_name} address={image.server_address} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

async function PassphraseChallenge({ code, error }: { code: string; error?: string }) {
  const { t } = await getI18n();
  const message =
    error === "invalid_passphrase"
      ? t("viewer.invalidPassphrase")
      : error === "too_many_attempts"
        ? t("viewer.tooManyAttempts")
        : null;
  return (
    <main className="mx-auto mt-[8vh] max-w-lg">
      <Card className="bg-card/95 shadow-2xl">
        <CardHeader>
          <p className="text-sm font-bold tracking-[0.16em] text-primary">
            {t("viewer.protectedEyebrow")}
          </p>
          <CardTitle className="text-3xl">{t("viewer.passphraseTitle")}</CardTitle>
          <CardDescription>{t("viewer.passphraseDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" method="post" action={`/${code}/unlock`}>
            {message && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {message}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="passphrase">{t("visibility.passphraseLabel")}</Label>
              <PassphraseInput id="passphrase" required autoFocus autoComplete="current-password" />
            </div>
            <Button type="submit">{t("viewer.openPage")}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
