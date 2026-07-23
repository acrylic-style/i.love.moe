import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";

export default async function NotFoundPage() {
  const { t } = await getI18n();
  return (
    <main className="mx-auto mt-[8vh] max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-5xl">404</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">{t("notFound.message")}</CardContent>
      </Card>
    </main>
  );
}
