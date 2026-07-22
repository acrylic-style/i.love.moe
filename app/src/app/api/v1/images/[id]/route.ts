import { getEnv } from "@/cloudflare";
import { deleteImage, withApiErrors } from "@/service";

export const dynamic = "force-dynamic";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => deleteImage(request, getEnv(), id));
}
