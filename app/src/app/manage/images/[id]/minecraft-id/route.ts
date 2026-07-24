import { getEnv } from "@/cloudflare";
import { updateManagedImageMinecraftIdVisibility, withApiErrors } from "@/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return withApiErrors(() => updateManagedImageMinecraftIdVisibility(request, getEnv(), id));
}
