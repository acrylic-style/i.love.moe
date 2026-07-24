import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { ImageUploadForm } from "@/components/image-upload-form";
import { ImageLibrary } from "@/components/image-library";
import { buttonVariants } from "@/components/ui/button";
import { imageLibrary, parseLibraryFilters } from "@/library";
import { planLimits } from "@/plans";
import { authenticateSessionToken } from "@/service";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function ImagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const filters = parseLibraryFilters(await searchParams);
  const [library, limits, { t }] = await Promise.all([
    imageLibrary(env, session.user_id, filters),
    planLimits(env, session.user_id),
    getI18n(),
  ]);
  return (
    <main className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-[0.16em] text-primary">{t("library.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("library.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("library.description")}</p>
        </div>
        <a className={buttonVariants({ variant: "outline" })} href="/manage">
          {t("common.backManage")}
        </a>
      </header>
      <ImageUploadForm />
      <ImageLibrary
        images={library.images}
        tags={library.tags}
        albums={library.albums}
        servers={library.servers}
        filters={filters}
        nextCursor={library.nextCursor}
        isPlus={limits.libraryOrganization}
      />
    </main>
  );
}
