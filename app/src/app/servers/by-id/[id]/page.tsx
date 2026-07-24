import { notFound, redirect } from "next/navigation";
import { getEnv } from "@/cloudflare";

export default async function ServerByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const server = await getEnv()
    .DB.prepare("SELECT code, slug FROM servers WHERE id = ?")
    .bind(id)
    .first<{ code: string; slug: string | null }>();
  if (!server) notFound();
  redirect(`/servers/${server.slug ?? server.code}`);
}
