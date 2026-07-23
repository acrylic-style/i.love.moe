import { getEnv } from "@/cloudflare";
import { deleteTag, updateTag } from "@/library";
import { withApiErrors } from "@/service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => updateTag(request, getEnv(), id));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withApiErrors(() => deleteTag(request, getEnv(), id));
}
