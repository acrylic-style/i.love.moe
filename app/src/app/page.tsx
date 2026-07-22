import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto mt-[8vh] max-w-3xl">
      <Card className="bg-card/95 py-4 shadow-2xl backdrop-blur sm:py-8">
        <CardHeader className="gap-4 px-6 sm:px-10">
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe</p>
          <CardTitle className="text-4xl leading-tight tracking-tight sm:text-6xl">Minecraftの一枚を、すぐ共有。</CardTitle>
          <CardDescription className="text-base leading-7 sm:text-lg">Fabric Modからスクリーンショットをアップロードし、短いURLをクリップボードへ届けます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 px-6 text-sm text-muted-foreground sm:px-10">
          <span>現在ベータ公開中です。Modの対応プラットフォームやバージョンは利用状況によって拡大予定です。</span>
          <a className={buttonVariants({ variant: "outline" })} href="https://github.com/acrylic-style/i.love.moe/releases">Modダウンロード</a>
          <a className={buttonVariants({ variant: "outline" })} href="/plus">Plusプランを見る</a>
        </CardContent>
      </Card>
    </main>
  );
}
