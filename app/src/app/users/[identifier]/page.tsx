import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { FavoriteButton } from "@/components/favorite-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import { serverFavoriteIpHash } from "@/servers";
import { type PublicUserImageSort, publicUserDetail } from "@/users";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}): Promise<Metadata> {
  const { identifier } = await params;
  const detail = await publicUserDetail(getEnv(), identifier);
  if (!detail) return {};
  const baseUrl = getEnv().PUBLIC_BASE_URL.replace(/\/$/, "");
  const canonicalUrl = `${baseUrl}/users/${detail.profile.slug}`;
  return {
    title: detail.profile.display_name,
    description: detail.profile.bio ?? undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "profile",
      title: detail.profile.display_name,
      description: detail.profile.bio ?? undefined,
      url: canonicalUrl,
      images: [`${canonicalUrl}/avatar`],
    },
    robots: { index: true, follow: true },
  };
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string }>;
}) {
  const { identifier } = await params;
  const query = await searchParams;
  const sort: PublicUserImageSort = query.sort === "favorites" ? "favorites" : "newest";
  const env = getEnv();
  const detail = await publicUserDetail(env, identifier, {
    sort,
    cursor: query.cursor,
    voterIpHash: await serverFavoriteIpHash(env, await headers()),
  });
  if (!detail) notFound();
  if (!detail.requestedIdentifierIsCurrent) {
    const destination = new URL(`/users/${detail.profile.slug}`, env.PUBLIC_BASE_URL);
    if (sort === "favorites") destination.searchParams.set("sort", sort);
    if (query.cursor) destination.searchParams.set("cursor", query.cursor);
    redirect(destination.toString());
  }
  const { t } = await getI18n();
  const { profile, images, albums } = detail;
  return (
    <main className="mx-auto max-w-6xl space-y-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="size-28 rounded-2xl border bg-muted object-cover [image-rendering:pixelated]"
          src={`/users/${profile.slug}/avatar`}
          alt=""
          width={160}
          height={160}
        />
        <div>
          <h1 className="text-4xl font-bold">{profile.display_name}</h1>
          <p className="mt-2 font-medium text-muted-foreground">{profile.minecraft_name}</p>
          {profile.bio && <p className="mt-4 max-w-3xl whitespace-pre-wrap">{profile.bio}</p>}
        </div>
      </header>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">{t("users.images")}</h2>
          <div className="flex gap-2">
            <a
              className={buttonVariants({ variant: sort === "newest" ? "default" : "outline" })}
              href={userGalleryQuery(profile.slug, "newest")}
            >
              {t("servers.sortNewest")}
            </a>
            <a
              className={buttonVariants({
                variant: sort === "favorites" ? "default" : "outline",
              })}
              href={userGalleryQuery(profile.slug, "favorites")}
            >
              {t("servers.sortFavorites")}
            </a>
          </div>
        </div>
        {images.length === 0 ? (
          <p className="text-muted-foreground">{t("users.noImages")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <article key={image.id}>
                <a href={`/${image.code}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="aspect-video w-full rounded-lg border object-cover"
                    src={`/raw/${image.code}`}
                    alt={image.title ?? ""}
                    loading="lazy"
                  />
                </a>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <a className="min-w-0 truncate" href={`/${image.code}`}>
                    {image.title ?? image.code}
                  </a>
                  <FavoriteButton
                    endpoint={`/favorites/images/${image.id}`}
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
            href={userGalleryQuery(profile.slug, sort, detail.nextImageCursor)}
          >
            {t("common.next")}
          </a>
        )}
      </section>
      {albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">{t("users.albums")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <a href={`/${album.code}`} key={album.id}>
                <Card className="h-full overflow-hidden pt-0">
                  {album.cover_code && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="aspect-video w-full object-cover"
                      src={`/raw/${album.cover_code}`}
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

function userGalleryQuery(slug: string, sort: PublicUserImageSort, cursor?: string): string {
  const query = new URLSearchParams();
  if (sort === "favorites") query.set("sort", sort);
  if (cursor) query.set("cursor", cursor);
  const value = query.toString();
  return `/users/${slug}${value ? `?${value}` : ""}`;
}
