import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LegalDocument({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <main className="mx-auto w-full max-w-4xl space-y-6">
    <a className="inline-flex text-sm text-muted-foreground hover:text-foreground" href="/">← i.らぶ.moeへ戻る</a>
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-3xl sm:text-4xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-10 pt-6 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </CardContent>
    </Card>
  </main>;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3">
    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
    {children}
  </section>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}
