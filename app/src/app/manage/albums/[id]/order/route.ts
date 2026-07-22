import { reorderAlbum } from "@/albums";
import { getEnv } from "@/cloudflare";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => reorderAlbum(request, getEnv(), id));
}
