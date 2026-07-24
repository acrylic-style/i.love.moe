import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { activeCustomDomainForServer } from "@/custom-domains";
import { getEnv } from "@/cloudflare";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerImageFavorite } from "@/components/server-image-favorite";
import { VerifiedMark } from "@/components/verified-mark";
import { getI18n } from "@/i18n/server";
import {
  displayServerAddress,
  type PublicServerImageSort,
  publicServerDetail,
  serverFavoriteIpHash,
} from "@/servers";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}): Promise<Metadata> {
  const { identifier } = await params;
  const detail = await publicServerDetail(getEnv(), identifier);
  if (!detail) return {};
  const title = detail.server.display_name ?? detail.server.display_address ?? identifier;
  const baseUrl = getEnv().PUBLIC_BASE_URL.replace(/\/$/, "");
  const imageUrl = detail.server.banner_key
    ? `${baseUrl}/servers/assets/${detail.server.id}/banner`
    : detail.images[0]
      ? `${baseUrl}/raw/${detail.images[0].code}`
      : undefined;
  return {
    title,
    description: detail.server.description ?? undefined,
    openGraph: {
      type: "website",
      title,
      description: detail.server.description ?? undefined,
      url: `${baseUrl}/servers/${detail.server.slug ?? detail.server.code}`,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: { index: true, follow: true },
  };
}

export default async function ServerPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string }>;
}) {
  const { identifier } = await params;
  const query = await searchParams;
  const sort: PublicServerImageSort = query.sort === "favorites" ? "favorites" : "newest";
  const env = getEnv();
  const voterIpHash = await serverFavoriteIpHash(env, await headers());
  const detail = await publicServerDetail(env, identifier, {
    sort,
    cursor: query.cursor,
    voterIpHash,
  });
  if (!detail) notFound();
  const canonical = detail.server.slug ?? detail.server.code;
  if (identifier !== canonical && identifier.toLowerCase() !== canonical.toLowerCase())
    redirect(`/servers/${canonical}`);
  const customDomain = await activeCustomDomainForServer(env, detail.server.id);
  if (customDomain) {
    const destination = new URL(`https://${customDomain}/`);
    if (sort === "favorites") destination.searchParams.set("sort", sort);
    if (query.cursor) destination.searchParams.set("cursor", query.cursor);
    redirect(destination.toString());
  }
  return <ServerGallery detail={detail} sort={sort} />;
}

export async function ServerGallery({
  detail,
  customOrigin,
  sort,
}: {
  detail: Awaited<ReturnType<typeof publicServerDetail>> & {};
  customOrigin?: string;
  sort: PublicServerImageSort;
}) {
  if (!detail) notFound();
  const { t } = await getI18n();
  const { server, images, albums } = detail;
  const url = (path: string) => `${customOrigin ?? ""}${path}`;
  const displayAddress = displayServerAddress(server.display_address ?? null);
  const claimUrl = new URL("/manage/servers/claim", getEnv().PUBLIC_BASE_URL);
  claimUrl.searchParams.set("address", server.display_address ?? "");
  return (
    <main className="mx-auto max-w-6xl space-y-10">
      {server.banner_key && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="max-h-80 w-full rounded-xl object-cover"
          src={`/servers/assets/${server.id}/banner`}
          alt=""
        />
      )}
      <header className="flex items-start gap-5">
        {server.icon_key && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="size-20 rounded-xl object-cover"
            src={`/servers/assets/${server.id}/icon`}
            alt=""
          />
        )}
        <div>
          <h1 className="text-4xl font-bold">{server.display_name ?? displayAddress}</h1>
          <p className="mt-2 text-muted-foreground">
            {displayAddress}
            {server.verified_at && (
              <>
                {" · "}
                <VerifiedMark label={t("servers.verified")} />
              </>
            )}
          </p>
          {server.description && (
            <p className="mt-4 max-w-3xl whitespace-pre-wrap">{server.description}</p>
          )}
          <a
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
            href={claimUrl.toString()}
          >
            {t("common.edit")}
          </a>
        </div>
      </header>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">{t("servers.images")}</h2>
          <div className="flex gap-2">
            <a
              className={buttonVariants({ variant: sort === "newest" ? "default" : "outline" })}
              href={galleryQueryUrl(customOrigin, "newest")}
            >
              {t("servers.sortNewest")}
            </a>
            <a
              className={buttonVariants({
                variant: sort === "favorites" ? "default" : "outline",
              })}
              href={galleryQueryUrl(customOrigin, "favorites")}
            >
              {t("servers.sortFavorites")}
            </a>
          </div>
        </div>
        {images.length === 0 ? (
          <p className="text-muted-foreground">{t("servers.noImages")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <article key={image.id}>
                <a href={url(`/${image.code}`)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="aspect-video w-full rounded-lg border object-cover"
                    src={url(`/raw/${image.code}`)}
                    alt={image.title ?? ""}
                    loading="lazy"
                  />
                </a>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <a className="min-w-0 truncate" href={url(`/${image.code}`)}>
                    {image.title ?? image.code}
                  </a>
                  <ServerImageFavorite
                    imageId={image.id}
                    initialCount={image.favorite_count}
                    initialFavorited={Boolean(image.viewer_favorited)}
                    label={t("servers.favorite")}
                    failedLabel={t("library.error.request_failed")}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
        {detail.nextImageCursor && (
          <a
            className={buttonVariants({ variant: "outline" })}
            href={galleryQueryUrl(customOrigin, sort, detail.nextImageCursor)}
          >
            {t("common.next")}
          </a>
        )}
      </section>
      {albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("servers.albums")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <a href={url(`/${album.code}`)} key={album.id}>
                <Card className="h-full overflow-hidden pt-0">
                  {album.cover_code && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="aspect-video w-full object-cover"
                      src={url(`/raw/${album.cover_code}`)}
                      alt=""
                    />
                  )}
                  <CardHeader>
                    <CardTitle>{album.title}</CardTitle>
                    <CardDescription>
                      {t("common.imageCount", { count: album.image_count })}
                    </CardDescription>
                  </CardHeader>
                  {album.description && <CardContent>{album.description}</CardContent>}
                </Card>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function galleryQueryUrl(
  customOrigin: string | undefined,
  sort: PublicServerImageSort,
  cursor?: string,
): string {
  const query = new URLSearchParams();
  if (sort === "favorites") query.set("sort", sort);
  if (cursor) query.set("cursor", cursor);
  const suffix = query.size ? `?${query}` : "";
  return `${customOrigin ?? ""}/${suffix}`;
}
