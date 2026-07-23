import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function HomePage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto mt-[8vh] max-w-3xl">
      <Card className="bg-card/95 py-4 shadow-2xl backdrop-blur sm:py-8">
        <CardHeader className="gap-4 px-6 sm:px-10">
          <p className="text-sm font-bold tracking-[0.16em] text-primary">i.らぶ.moe</p>
          <CardTitle className="text-4xl leading-tight tracking-tight sm:text-6xl">
            {t("home.title")}
          </CardTitle>
          <CardDescription className="text-base leading-7 sm:text-lg">
            {t("home.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 px-6 text-sm text-muted-foreground sm:px-10">
          <span>{t("home.beta")}</span>
          <a
            className={buttonVariants({ variant: "outline" })}
            href="https://github.com/acrylic-style/i.love.moe"
          >
            {t("home.download")}
          </a>
          <a className={buttonVariants({ variant: "outline" })} href="/plus">
            {t("home.viewPlus")}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
