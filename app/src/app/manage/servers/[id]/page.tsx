import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { AsyncForm } from "@/components/async-form";
import { ServerManager } from "@/components/server-manager";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { customDomainForServer } from "@/custom-domains";
import { getI18n } from "@/i18n/server";
import { authenticateSessionToken } from "@/service";
import {
  canUseServerPlus,
  type ManagedServerImageFilter,
  managedServerDetail,
  managedServerImages,
} from "@/servers";

export const dynamic = "force-dynamic";

export default async function ManageServerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ feed?: string; cursor?: string }>;
}) {
  const { locale, t } = await getI18n();
  const { id } = await params;
  const query = await searchParams;
  const feedFilter: ManagedServerImageFilter =
    query.feed === "hidden" || query.feed === "featured" ? query.feed : "visible";
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const [detail, domain, plus, feedPage, editors] = await Promise.all([
    managedServerDetail(env, session.user_id, id),
    customDomainForServer(env, id),
    canUseServerPlus(env, id),
    managedServerImages(env, id, { filter: feedFilter, cursor: query.cursor }),
    env.DB.prepare(
      `SELECT m.user_id, u.email FROM server_members m JOIN users u ON u.id = m.user_id
        WHERE m.server_id = ? AND m.role = 'editor' ORDER BY m.created_at`,
    )
      .bind(id)
      .all<{ user_id: string; email: string }>(),
  ]);
  if (!detail) notFound();
  const feedImages = feedPage.images;
  const ja = locale === "ja";
  const copy = ja
    ? {
        profile: "基本情報",
        name: "サーバー名",
        description: "説明",
        slug: "URLスラッグ",
        save: "保存",
        addresses: "Minecraftアドレス",
        addressHelp: "同じサーバーとして扱う接続先を追加し、それぞれ所有確認します。",
        addAddress: "接続先を追加",
        add: "追加",
        verified: "確認済み",
        pending: "確認待ち",
        dns: "DNSで確認",
        motd: "MOTDで確認",
        startVerification: "確認用の設定",
        checkVerification: "設定を確認",
        tokenOnly: "MOTDで確認する場合は、MOTDを一時的にトークンだけにしてください。",
        remove: "削除",
        customDomain: "独自ドメイン",
        domainHelp: "一般公開ギャラリー用のサブドメインを接続します。",
        hostname: "ホスト名",
        connect: "接続",
        refresh: "状態を更新",
        disconnect: "接続を解除",
        cnameTarget: "CNAME接続先",
        plusRequired: "独自ドメインはPlusで使えます。",
        saving: "保存中…",
        working: "処理中…",
        saved: "保存しました",
        completed: "完了しました",
        failed: "失敗しました",
      }
    : {
        profile: "Profile",
        name: "Server name",
        description: "Description",
        slug: "URL slug",
        save: "Save",
        addresses: "Minecraft addresses",
        addressHelp: "Add every connection address belonging to this server and verify each one.",
        addAddress: "Add address",
        add: "Add",
        verified: "Verified",
        pending: "Verification pending",
        dns: "Verify with DNS",
        motd: "Verify with MOTD",
        startVerification: "Verification setup",
        checkVerification: "Check configuration",
        tokenOnly: "For MOTD verification, temporarily set the entire MOTD to the token only.",
        remove: "Remove",
        customDomain: "Custom domain",
        domainHelp: "Connect a subdomain for the public gallery.",
        hostname: "Hostname",
        connect: "Connect",
        refresh: "Refresh status",
        disconnect: "Disconnect",
        cnameTarget: "CNAME target",
        plusRequired: "Custom domains are available with Plus.",
        saving: "Saving…",
        working: "Working…",
        saved: "Saved.",
        completed: "Done",
        failed: "Failed",
      };
  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <a className={buttonVariants({ variant: "ghost" })} href="/manage/servers">
        ← {t("common.backManage")}
      </a>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">
            {detail.server.display_name ?? detail.server.display_address}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-10">
          <ServerManager
            serverId={id}
            profile={{
              displayName: detail.server.display_name ?? "",
              description: detail.server.description ?? "",
              slug: detail.server.slug ?? "",
            }}
            addresses={detail.addresses}
            domain={domain}
            plus={plus}
            owner={detail.role === "owner"}
            canVerifyAddresses={
              detail.role === "owner" || detail.server.pending_owner_user_id === session.user_id
            }
            transferVerification={detail.server.pending_owner_user_id === session.user_id}
            cnameTarget={env.SAAS_CNAME_TARGET ?? "mc.moe.pictures"}
            copy={copy}
          />
          {plus && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">{ja ? "画像設定" : "Branding"}</h2>
              {(["icon", "banner"] as const).map((kind) => (
                <AsyncForm
                  key={kind}
                  className="flex flex-wrap items-end gap-3"
                  action={`/manage/servers/${id}/branding`}
                  idle={ja ? "アップロード" : "Upload"}
                  pending={ja ? "アップロード中…" : "Uploading…"}
                  saved={ja ? "完了しました" : "Done"}
                  failed={ja ? "失敗しました" : "Failed"}
                  resetOnSuccess
                >
                  <input type="hidden" name="kind" value={kind} />
                  <label className="grid gap-2 text-sm">
                    <span>
                      {kind === "icon" ? (ja ? "アイコン" : "Icon") : ja ? "バナー" : "Banner"}
                    </span>
                    <input
                      type="file"
                      name="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                    />
                  </label>
                </AsyncForm>
              ))}
            </section>
          )}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">{ja ? "公開フィード" : "Public feed"}</h2>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["visible", ja ? "掲載中" : "Visible"],
                    ["hidden", ja ? "非表示" : "Hidden"],
                    ["featured", ja ? "注目画像" : "Featured"],
                  ] as const
                ).map(([value, label]) => (
                  <a
                    className={buttonVariants({
                      variant: feedFilter === value ? "default" : "outline",
                      size: "sm",
                    })}
                    href={`?feed=${value}`}
                    key={value}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
            {feedImages.length === 0 ? (
              <p className="text-muted-foreground">
                {feedFilter === "hidden"
                  ? ja
                    ? "非表示の画像はありません。"
                    : "There are no hidden images."
                  : feedFilter === "featured"
                    ? ja
                      ? "注目画像は設定されていません。"
                      : "No featured image is selected."
                    : ja
                      ? "掲載中の画像はまだありません。"
                      : "There are no visible images yet."}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {feedImages.map((image) => (
                  <div className="overflow-hidden rounded-lg border" key={image.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="aspect-video w-full object-cover"
                      src={`/raw/${image.code}`}
                      alt={image.title ?? ""}
                      loading="lazy"
                    />
                    <div className="space-y-3 p-3">
                      <p className="truncate font-medium">{image.title ?? image.code}</p>
                      <div className="flex flex-wrap gap-2">
                        <AsyncForm
                          action={`/manage/servers/${id}/feed`}
                          idle={
                            image.hidden_from_feed
                              ? ja
                                ? "再表示"
                                : "Show"
                              : ja
                                ? "非表示"
                                : "Hide"
                          }
                          pending={ja ? "処理中…" : "Working…"}
                          saved={ja ? "完了しました" : "Done"}
                          failed={ja ? "失敗しました" : "Failed"}
                          buttonProps={{ variant: "outline", size: "sm" }}
                        >
                          <input type="hidden" name="imageId" value={image.id} />
                          <input
                            type="hidden"
                            name="action"
                            value={image.hidden_from_feed ? "show" : "hide"}
                          />
                        </AsyncForm>
                        {plus && (
                          <AsyncForm
                            action={`/manage/servers/${id}/feed`}
                            idle={
                              detail.server.featured_image_id === image.id
                                ? ja
                                  ? "注目を解除"
                                  : "Unfeature"
                                : ja
                                  ? "注目画像にする"
                                  : "Feature"
                            }
                            pending={ja ? "処理中…" : "Working…"}
                            saved={ja ? "完了しました" : "Done"}
                            failed={ja ? "失敗しました" : "Failed"}
                            buttonProps={{ variant: "outline", size: "sm" }}
                          >
                            <input type="hidden" name="imageId" value={image.id} />
                            <input
                              type="hidden"
                              name="action"
                              value={
                                detail.server.featured_image_id === image.id
                                  ? "unfeature"
                                  : "feature"
                              }
                            />
                          </AsyncForm>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {feedPage.nextCursor && (
              <a
                className={buttonVariants({ variant: "outline" })}
                href={`?feed=${feedFilter}&cursor=${encodeURIComponent(feedPage.nextCursor)}`}
              >
                {ja ? "次へ" : "Next"}
              </a>
            )}
          </section>
          {detail.role === "owner" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">{ja ? "編集者" : "Editors"}</h2>
              {plus ? (
                <AsyncForm
                  className="flex gap-2"
                  action={`/manage/servers/${id}/editors`}
                  idle={ja ? "招待" : "Invite"}
                  pending={ja ? "送信中…" : "Sending…"}
                  saved={ja ? "送信しました" : "Sent"}
                  failed={ja ? "失敗しました" : "Failed"}
                  resetOnSuccess
                >
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    type="email"
                    name="email"
                    required
                    maxLength={254}
                    placeholder="editor@example.com"
                  />
                </AsyncForm>
              ) : (
                <p className="text-muted-foreground">
                  {ja
                    ? "編集者の招待はPlusで使えます。"
                    : "Editor invitations are available with Plus."}
                </p>
              )}
              {editors.results.map((editor) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  key={editor.user_id}
                >
                  <span>{editor.email}</span>
                  <div className="flex flex-wrap gap-2">
                    <AsyncForm
                      action={`/manage/servers/${id}/editors/${editor.user_id}`}
                      idle={ja ? "削除" : "Remove"}
                      pending={ja ? "削除中…" : "Removing…"}
                      saved={ja ? "削除しました" : "Removed"}
                      failed={ja ? "失敗しました" : "Failed"}
                      buttonProps={{ variant: "destructive", size: "sm" }}
                    />
                    <AsyncForm
                      action={`/manage/servers/${id}/ownership`}
                      idle={ja ? "所有権を移す" : "Transfer ownership"}
                      pending={ja ? "処理中…" : "Working…"}
                      saved={ja ? "手続きを開始しました" : "Transfer started"}
                      failed={ja ? "失敗しました" : "Failed"}
                      buttonProps={{ variant: "outline", size: "sm" }}
                    >
                      <input type="hidden" name="userId" value={editor.user_id} />
                    </AsyncForm>
                  </div>
                </div>
              ))}
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
