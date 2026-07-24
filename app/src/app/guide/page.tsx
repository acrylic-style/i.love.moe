import type { Metadata } from "next";
import { Download, Info } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";

//const MODRINTH_URL = "https://modrinth.com/mod/i-love-moe";

// Modrinth is still under review
const MODRINTH_URL = "https://github.com/acrylic-style/i.love.moe/releases";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("guide.metadataTitle") };
}

export default async function GuidePage() {
  const { t } = await getI18n();
  const steps = [
    [t("guide.step1Title"), t("guide.step1Description")],
    [t("guide.step2Title"), t("guide.step2Description")],
    [t("guide.step3Title"), t("guide.step3Description")],
    [t("guide.step4Title"), t("guide.step4Description")],
  ] as const;

  return (
    <main className="mx-auto max-w-5xl space-y-10">
      <section className="space-y-4">
        <p className="text-sm font-bold tracking-[0.16em] text-primary">{t("guide.eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{t("guide.title")}</h1>
        <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
          {t("guide.description")}
        </p>
      </section>

      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="sm:flex-row sm:items-start sm:gap-4">
          <Info className="size-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-2">
            <CardTitle>{t("guide.modRequiredTitle")}</CardTitle>
            <CardDescription className="text-base leading-7">
              {t("guide.modRequiredDescription")}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <h2 className="text-3xl font-semibold">{t("guide.requirementsTitle")}</h2>
        <Card>
          <CardContent>
            <ul className="list-disc space-y-3 pl-5 text-muted-foreground">
              <li>{t("guide.requirementFabric")}</li>
              <li>{t("guide.requirementVersions")}</li>
              <li>{t("guide.requirementReview")}</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-3xl font-semibold">{t("guide.stepsTitle")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map(([title, description]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="text-base leading-7">{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("guide.plusTitle")}</CardTitle>
          <CardDescription className="text-base leading-7">
            {t("guide.plusDescription")}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a
          className={buttonVariants({ size: "lg" })}
          href={MODRINTH_URL}
          target="_blank"
          rel="noreferrer"
        >
          <Download className="size-4" aria-hidden="true" />
          {t("guide.download")}
        </a>
        <a className={buttonVariants({ variant: "outline", size: "lg" })} href="/plus">
          {t("guide.viewPlus")}
        </a>
      </div>
    </main>
  );
}
