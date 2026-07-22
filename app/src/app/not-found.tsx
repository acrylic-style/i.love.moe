import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return <main className="mx-auto mt-[8vh] max-w-3xl"><Card><CardHeader><CardTitle className="text-5xl">404</CardTitle></CardHeader><CardContent className="text-muted-foreground">画像またはアルバムが見つからないか、公開期間が終了しています。</CardContent></Card></main>;
}
