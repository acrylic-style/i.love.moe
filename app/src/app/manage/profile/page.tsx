import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserProfileManager } from "@/components/user-profile-manager";
import { getI18n } from "@/i18n/server";
import { authenticateSessionToken } from "@/service";
import { managedUserProfile } from "@/users";
import { verifiedMinecraftProfiles } from "@/web-auth";

export const dynamic = "force-dynamic";

export default async function ManageUserProfilePage() {
  const env = getEnv();
  const token = (await cookies()).get("session")?.value;
  const session = await authenticateSessionToken(token, env);
  if (!session) notFound();
  const [{ t }, profile, minecraftProfiles] = await Promise.all([
    getI18n(),
    managedUserProfile(env, session.user_id),
    verifiedMinecraftProfiles(env, session.user_id),
  ]);
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <a className={buttonVariants({ variant: "ghost" })} href="/manage">
        {t("common.backManage")}
      </a>
      <Card>
        <CardHeader>
          <CardTitle>{t("users.manageTitle")}</CardTitle>
          <CardDescription>{t("users.manageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {minecraftProfiles.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("users.noVerifiedProfile")}</p>
              <a className={buttonVariants({ variant: "outline" })} href="/manage">
                {t("users.verifyMinecraft")}
              </a>
            </div>
          ) : (
            <UserProfileManager
              profile={
                profile
                  ? {
                      displayName: profile.display_name,
                      bio: profile.bio ?? "",
                      slug: profile.slug,
                      primaryMinecraftUuid: profile.primary_minecraft_uuid,
                      published: profile.published_at !== null,
                    }
                  : null
              }
              minecraftProfiles={minecraftProfiles}
              copy={{
                displayName: t("users.displayName"),
                bio: t("users.bio"),
                slug: t("users.slug"),
                slugHelp: t("users.slugHelp"),
                minecraftProfile: t("users.minecraftProfile"),
                minecraftProfileHelp: t("users.minecraftProfileHelp"),
                published: t("users.published"),
                publishedHelp: t("users.publishedHelp"),
                save: t("common.save"),
                saving: t("common.saving"),
                saved: t("common.saved"),
                failed: t("users.saveFailed"),
                invalidProfile: t("users.invalidProfile"),
                invalidPrimaryProfile: t("users.invalidPrimaryProfile"),
                slugUnavailable: t("users.slugUnavailable"),
              }}
            />
          )}
        </CardContent>
      </Card>
      {profile?.published_at && (
        <a className={buttonVariants()} href={`/users/${profile.slug}`}>
          {t("users.viewProfile")}
        </a>
      )}
    </main>
  );
}
