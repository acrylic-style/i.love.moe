import { cookies } from "next/headers";
import { CheckIcon } from "lucide-react";
import { getEnv } from "@/cloudflare";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { subscriptionSummary } from "@/plans";
import { authenticateSessionToken } from "@/service";

export const dynamic = "force-dynamic";

const FEATURES = [
  "直近30日で500枚アップロード",
  "画像をアップロードから1年間保存",
  "アルバム100冊・1冊につき200枚",
  "非公開と合言葉付き公開",
  "加入前の未失効画像も1年保存へ移行",
];

export default async function PlusPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const env = getEnv();
  const session = await authenticateSessionToken((await cookies()).get("session")?.value, env);
  const subscription = session ? await subscriptionSummary(env, session.user_id) : null;
  const { checkout } = await searchParams;
  return <main className="mx-auto max-w-4xl space-y-6">
    <a className={buttonVariants({ variant: "ghost" })} href={session ? "/manage" : "/"}>← 戻る</a>
    {checkout === "canceled" && <p className="rounded-md border px-4 py-3 text-sm">お申し込みはキャンセルされました。料金は発生していません。</p>}
    <Card className="overflow-hidden border-primary/40 bg-card/95 shadow-2xl">
      <CardHeader className="text-center"><p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe Plus</p>
        <CardTitle className="text-4xl sm:text-5xl">もっと残して、もっと整理。</CardTitle>
        <CardDescription className="text-base">Minecraftの思い出を、長く安全に共有するためのプランです。</CardDescription>
      </CardHeader>
      <CardContent className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center"><span className="text-5xl font-bold">480円</span><span className="text-muted-foreground">／月</span><p className="mt-2 text-sm text-muted-foreground">いつでも期間末で解約できます。</p></div>
        <ul className="space-y-3">{FEATURES.map((feature) => <li className="flex gap-3" key={feature}><CheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span>{feature}</span></li>)}</ul>
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">解約後も保存期限と公開状態は維持されます。新しいアップロードや編集には無料プランの上限が適用されます。</div>
      </CardContent>
      <CardFooter className="justify-center">
        {!session ? <a className={buttonVariants({ size: "lg" })} href="/manage">ログインして申し込む</a>
          : subscription?.plan === "plus" || (subscription?.status && subscription.status !== "canceled" && subscription.status !== "incomplete_expired") ? <form method="post" action="/api/billing/portal"><Button size="lg" type="submit" variant="outline">契約内容を確認</Button></form>
            : <form method="post" action="/api/billing/checkout"><Button size="lg" type="submit">Plusを始める</Button></form>}
      </CardFooter>
    </Card>
  </main>;
}
