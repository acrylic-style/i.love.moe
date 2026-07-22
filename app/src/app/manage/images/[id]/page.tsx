import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEnv } from "@/cloudflare";
import { ImageTitleForm } from "@/components/image-title-form";
import { ImageVisibilityForm } from "@/components/image-visibility-form";
import { LocalDateTime } from "@/components/local-date-time";
import { ServerMetadata } from "@/components/server-metadata";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticateSessionToken, managedImageDetail } from "@/service";
import { planLimits } from "@/plans";

export const dynamic = "force-dynamic";

export default async function EditImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  if (!session) notFound();
  const [image, limits] = await Promise.all([managedImageDetail(env, session.user_id, id), planLimits(env, session.user_id)]);
  if (!image) notFound();

  const expires = new Date(image.expires_at).toISOString();
  const size = image.byte_size >= 1024 * 1024
    ? `${(image.byte_size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(image.byte_size / 1024)} KB`;

  return <main className="mx-auto max-w-4xl space-y-4">
    <a className={buttonVariants({ variant: "ghost" })} href="/manage">← 管理画面</a>
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 sm:grid-cols-[1fr_auto]">
        <div><p className="text-sm font-bold tracking-[0.16em] text-primary">Image</p><CardTitle className="mt-1 text-3xl">{image.title ?? "タイトルなし"}</CardTitle>
          <CardDescription className="mt-2"><a className="text-primary hover:underline" href={`/${image.code}`}>共有ページを開く</a></CardDescription>
        </div>
        <form className="sm:col-start-2 sm:row-start-1" method="post" action={`/manage/images/${id}/delete`}><Button variant="destructive" type="submit">画像を削除</Button></form>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="overflow-hidden rounded-xl border bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mx-auto max-h-[65vh] max-w-full object-contain" src={`/raw/${image.code}`} width={image.width} height={image.height} alt={image.title ?? "Minecraft screenshot"} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>{image.width} × {image.height}</span><span>{size}</span><span><LocalDateTime value={expires} />まで</span></div>
        <ServerMetadata name={image.server_name} address={image.server_address} />
        <div className="space-y-8 border-t pt-8">
          <ImageTitleForm imageId={image.id} initialTitle={image.title} />
          <ImageVisibilityForm imageId={image.id} initialVisibility={image.visibility} hasPassphrase={Boolean(image.has_passphrase)} allowProtected={limits.protectedSharing} />
        </div>
      </CardContent>
    </Card>
  </main>;
}
